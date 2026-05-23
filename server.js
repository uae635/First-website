import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import * as db from './db.js';
import { extractContract, extractCheque } from './services/ai.js';
import { sendReminderEmail, sendTestEmail } from './services/email.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(__dirname, 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const upload = multer({ dest: UPLOADS_DIR });

// ── Payment schedule generator ────────────────────────────────────────────────
function generatePaymentSchedule(unitId, contractStart, contractEnd, rentAmount, frequency, dueDay) {
  const payments = [];

  // Parse as LOCAL dates (avoid UTC-offset shifting "2025-03-01" → Feb 28 local)
  const [sy, sm, sd] = contractStart.split('-').map(Number);
  const [ey, em, ed] = contractEnd.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);   // local midnight
  const end   = new Date(ey, em - 1, ed);   // local midnight

  const localDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const stepMonths = { monthly: 1, 'every-two-months': 2, quarterly: 3 };
  const step = stepMonths[frequency] || 1;
  const amount = rentAmount * step;

  let current = new Date(start.getFullYear(), start.getMonth(), dueDay || 1);
  // Advance to next period if the due day hasn't arrived yet in the start month
  if (current < start) current.setMonth(current.getMonth() + 1);

  while (current <= end) {
    const periodEnd = new Date(current);
    periodEnd.setMonth(periodEnd.getMonth() + step);
    periodEnd.setDate(periodEnd.getDate() - 1);

    const periodEndCapped = periodEnd > end ? end : periodEnd;
    payments.push({
      id: uuid(),
      unit_id: unitId,
      due_date: localDate(current),
      amount,
      period_start: localDate(current),
      period_end: localDate(periodEndCapped),
      status: 'pending'
    });

    current.setMonth(current.getMonth() + step);
  }

  return payments;
}

// ── Properties ────────────────────────────────────────────────────────────────
app.get('/api/properties', (req, res) => {
  const properties = db.getProperties();
  const result = properties.map(p => {
    const units = db.getUnits(p.id);
    return { ...p, unitCount: units.length };
  });
  res.json(result);
});

app.post('/api/properties', (req, res) => {
  const { name, address } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuid();
  db.insertProperty(id, name, address || '');
  res.json(db.getProperty(id));
});

app.delete('/api/properties/:id', (req, res) => {
  db.deleteProperty(req.params.id);
  res.json({ ok: true });
});

// ── Units ─────────────────────────────────────────────────────────────────────
app.get('/api/units', (req, res) => {
  const { propertyId } = req.query;
  if (!propertyId) return res.status(400).json({ error: 'propertyId required' });
  res.json(db.getUnits(propertyId));
});

app.post('/api/units', (req, res) => {
  const { propertyId, unitNumber, tenants, contractStart, contractEnd,
    rentAmount, paymentFrequency, paymentDueDay, contractFilename } = req.body;

  if (!propertyId || !unitNumber) return res.status(400).json({ error: 'propertyId and unitNumber required' });

  const id = uuid();
  db.insertUnit({
    id,
    property_id: propertyId,
    unit_number: unitNumber,
    tenants_json: JSON.stringify(tenants || []),
    contract_start: contractStart || null,
    contract_end: contractEnd || null,
    rent_amount: rentAmount || 0,
    payment_frequency: paymentFrequency || 'monthly',
    payment_due_day: paymentDueDay || 1,
    contract_filename: contractFilename || null
  });

  if (contractStart && contractEnd && rentAmount) {
    const payments = generatePaymentSchedule(id, contractStart, contractEnd,
      rentAmount, paymentFrequency || 'monthly', paymentDueDay || 1);
    for (const p of payments) db.insertPayment(p);
  }

  res.json({ ...db.getUnit(id), payments: db.getPayments(id) });
});

app.put('/api/units/:id', (req, res) => {
  const { unitNumber, tenants, contractStart, contractEnd,
    rentAmount, paymentFrequency, paymentDueDay, contractFilename } = req.body;

  db.updateUnit({
    id: req.params.id,
    unit_number: unitNumber,
    tenants_json: JSON.stringify(tenants || []),
    contract_start: contractStart || null,
    contract_end: contractEnd || null,
    rent_amount: rentAmount || 0,
    payment_frequency: paymentFrequency || 'monthly',
    payment_due_day: paymentDueDay || 1,
    contract_filename: contractFilename || null
  });

  db.deletePaymentsForUnit(req.params.id);

  if (contractStart && contractEnd && rentAmount) {
    const payments = generatePaymentSchedule(req.params.id, contractStart, contractEnd,
      rentAmount, paymentFrequency || 'monthly', paymentDueDay || 1);
    for (const p of payments) db.insertPayment(p);
  }

  res.json({ ...db.getUnit(req.params.id), payments: db.getPayments(req.params.id) });
});

app.delete('/api/units/:id', (req, res) => {
  db.deleteUnit(req.params.id);
  res.json({ ok: true });
});

// ── Payments ──────────────────────────────────────────────────────────────────
app.get('/api/payments', (req, res) => {
  const { unitId } = req.query;
  if (!unitId) return res.status(400).json({ error: 'unitId required' });
  res.json(db.getPayments(unitId));
});

app.get('/api/payments/upcoming', (req, res) => {
  const overdue = db.getOverduePayments();
  const upcoming = db.getUpcomingPayments();
  const upcomingFiltered = upcoming.filter(u => !overdue.find(o => o.id === u.id));
  res.json({ overdue, upcoming: upcomingFiltered });
});

app.post('/api/payments/:id/collect', upload.single('cheque'), async (req, res) => {
  const { method, collectedDate, chequeNumber, notes } = req.body;
  let chequeData = null;

  if (req.file) {
    try {
      const settings = db.getAllSettings();
      const apiKey = settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
      chequeData = await extractCheque(req.file, apiKey);
    } catch (e) {
      console.error('[cheque extract]', e.message);
    }
  }

  db.markPaymentCollected(
    req.params.id,
    method,
    collectedDate || new Date().toISOString().slice(0, 10),
    req.file ? req.file.filename : null,
    chequeNumber || chequeData?.chequeNumber || null,
    notes || null
  );

  res.json({ ok: true, chequeData });
});

// ── Attach cheque to payment (without marking collected) ──────────────────────
app.put('/api/payments/:id/cheque', (req, res) => {
  const { chequeFilename, chequeNumber } = req.body;
  db.updatePaymentCheque(req.params.id, chequeFilename || null, chequeNumber || null);
  res.json({ ok: true });
});

// ── AI Extraction ─────────────────────────────────────────────────────────────
app.post('/api/extract/contract', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  try {
    const settings = db.getAllSettings();
    const apiKey = settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Anthropic API key not configured. Add it in Settings.' });
    const data = await extractContract(req.file, apiKey);
    res.json({ data, filename: req.file.filename, originalname: req.file.originalname });
  } catch (err) {
    console.error('[extract contract]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/extract/cheque', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  try {
    const settings = db.getAllSettings();
    const apiKey = settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Anthropic API key not configured. Add it in Settings.' });
    const data = await extractCheque(req.file, apiKey);
    res.json({ data, filename: req.file.filename });
  } catch (err) {
    console.error('[extract cheque]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Files ─────────────────────────────────────────────────────────────────────
app.get('/api/files/:filename', (req, res) => {
  res.sendFile(join(UPLOADS_DIR, req.params.filename));
});

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const s = db.getAllSettings();
  // Never expose password to frontend
  if (s.email_pass) s.email_pass = '••••••••';
  res.json(s);
});

app.put('/api/settings', (req, res) => {
  const allowed = ['anthropic_api_key', 'email_host', 'email_port', 'email_user',
    'email_pass', 'email_recipient', 'currency', 'google_client_id', 'google_api_key'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'email_pass' && req.body[key] === '••••••••') continue;
      updates[key] = req.body[key];
    }
  }
  db.setSettings(updates);
  res.json({ ok: true });
});

app.post('/api/settings/test-email', async (req, res) => {
  try {
    const settings = db.getAllSettings();
    if (!settings.email_user || !settings.email_pass) {
      return res.status(400).json({ error: 'Email not configured' });
    }
    const result = await sendTestEmail(settings);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/send-reminder-now', async (req, res) => {
  try {
    const settings = db.getAllSettings();
    const overdue = db.getOverduePayments();
    const upcoming = db.getUpcomingPayments();
    const result = await sendReminderEmail(settings, overdue, upcoming);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PropertyTrack running at http://localhost:${PORT}`);
  startScheduler();
});
