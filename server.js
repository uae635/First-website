import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import * as db from './db.js';
import { extractContract, extractCheque } from './services/ai.js';
import { sendReminderEmail, sendTestEmail } from './services/email.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(__dirname, 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

const JWT_SECRET = process.env.JWT_SECRET || 'pt-secret-change-in-production';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const upload = multer({ dest: UPLOADS_DIR });

// ── Auth middleware ───────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Login required' });
  try {
    const { userId } = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired — please log in again' });
  }
}

// ── Auth Routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (db.getUserByEmail(email)) return res.status(409).json({ error: 'That email is already registered' });
    const hash = await bcrypt.hash(password, 10);
    const user = db.createUser(email, hash, name || email.split('@')[0]);
    // Migrate any existing properties (created before auth) to the first user
    db.claimOrphanedProperties(user.id);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    console.error('[register]', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = db.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    console.error('[login]', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, name: user.name });
});

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
app.get('/api/properties', authenticate, (req, res) => {
  const properties = db.getProperties(req.userId);
  const result = properties.map(p => {
    const units = db.getUnits(p.id);
    return { ...p, unitCount: units.length };
  });
  res.json(result);
});

app.post('/api/properties', authenticate, (req, res) => {
  const { name, address } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuid();
  db.insertProperty(id, name, address || '', req.userId);
  res.json(db.getProperty(id));
});

app.delete('/api/properties/:id', authenticate, (req, res) => {
  const prop = db.getProperty(req.params.id);
  if (!prop || prop.user_id !== req.userId) return res.status(403).json({ error: 'Access denied' });
  db.deleteProperty(req.params.id);
  res.json({ ok: true });
});

// ── Units ─────────────────────────────────────────────────────────────────────
app.get('/api/units', authenticate, (req, res) => {
  const { propertyId } = req.query;
  if (!propertyId) return res.status(400).json({ error: 'propertyId required' });
  const prop = db.getProperty(propertyId);
  if (!prop || prop.user_id !== req.userId) return res.status(403).json({ error: 'Access denied' });
  res.json(db.getUnits(propertyId));
});

app.post('/api/units', authenticate, (req, res) => {
  const { propertyId, unitNumber, tenants, contractStart, contractEnd,
    rentAmount, paymentFrequency, paymentDueDay, contractFilename } = req.body;

  if (!propertyId || !unitNumber) return res.status(400).json({ error: 'propertyId and unitNumber required' });

  const prop = db.getProperty(propertyId);
  if (!prop || prop.user_id !== req.userId) return res.status(403).json({ error: 'Access denied' });

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

app.put('/api/units/:id', authenticate, (req, res) => {
  const unit = db.getUnit(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  const prop = db.getProperty(unit.property_id);
  if (!prop || prop.user_id !== req.userId) return res.status(403).json({ error: 'Access denied' });

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

app.delete('/api/units/:id', authenticate, (req, res) => {
  const unit = db.getUnit(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  const prop = db.getProperty(unit.property_id);
  if (!prop || prop.user_id !== req.userId) return res.status(403).json({ error: 'Access denied' });
  db.deleteUnit(req.params.id);
  res.json({ ok: true });
});

// ── Payments ──────────────────────────────────────────────────────────────────
app.get('/api/payments', authenticate, (req, res) => {
  const { unitId } = req.query;
  if (!unitId) return res.status(400).json({ error: 'unitId required' });
  const unit = db.getUnit(unitId);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  const prop = db.getProperty(unit.property_id);
  if (!prop || prop.user_id !== req.userId) return res.status(403).json({ error: 'Access denied' });
  res.json(db.getPayments(unitId));
});

app.get('/api/payments/upcoming', authenticate, (req, res) => {
  const overdue = db.getOverduePayments(req.userId);
  const upcoming = db.getUpcomingPayments(req.userId);
  const upcomingFiltered = upcoming.filter(u => !overdue.find(o => o.id === u.id));
  res.json({ overdue, upcoming: upcomingFiltered });
});

app.post('/api/payments/:id/collect', authenticate, upload.single('cheque'), async (req, res) => {
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
app.put('/api/payments/:id/cheque', authenticate, (req, res) => {
  const { chequeFilename, chequeNumber } = req.body;
  db.updatePaymentCheque(req.params.id, chequeFilename || null, chequeNumber || null);
  res.json({ ok: true });
});

// ── AI Extraction ─────────────────────────────────────────────────────────────
app.post('/api/extract/contract', authenticate, upload.single('file'), async (req, res) => {
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

app.post('/api/extract/cheque', authenticate, upload.single('file'), async (req, res) => {
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
app.get('/api/settings', authenticate, (req, res) => {
  const s = db.getAllSettings();
  if (s.email_pass) s.email_pass = '••••••••';
  res.json(s);
});

app.put('/api/settings', authenticate, (req, res) => {
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

app.post('/api/settings/test-email', authenticate, async (req, res) => {
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

app.post('/api/settings/send-reminder-now', authenticate, async (req, res) => {
  try {
    const settings = db.getAllSettings();
    const overdue = db.getOverduePayments(req.userId);
    const upcoming = db.getUpcomingPayments(req.userId);
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
