/**
 * db.js — JSON file database (no native deps, works on any OS/Node version)
 * Exports the same functions as the original SQLite version.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = join(DATA_DIR, 'db.json');

function load() {
  if (!existsSync(DB_PATH)) return { users: [], properties: [], units: [], payments: [], settings: {} };
  try {
    const db = JSON.parse(readFileSync(DB_PATH, 'utf8'));
    if (!db.users) db.users = [];
    return db;
  }
  catch { return { users: [], properties: [], units: [], payments: [], settings: {} }; }
}

function save(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ── Users ─────────────────────────────────────────────────────────────────────
export function getUserByEmail(email) {
  return load().users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function getUserById(id) {
  return load().users.find(u => u.id === id) || null;
}

export function createUser(email, passwordHash, name) {
  const db = load();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const user = { id, email, password_hash: passwordHash, name, created_at: new Date().toISOString() };
  db.users.push(user);
  save(db);
  return user;
}

// Assign all properties without a user_id to the given user (migration for first user)
export function claimOrphanedProperties(userId) {
  const db = load();
  let changed = false;
  db.properties.forEach(p => { if (!p.user_id) { p.user_id = userId; changed = true; } });
  if (changed) save(db);
}

// ── Properties ────────────────────────────────────────────────────────────────
export function getProperties(userId) {
  return load().properties
    .filter(p => p.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getProperty(id) {
  return load().properties.find(p => p.id === id) || null;
}

export function insertProperty(id, name, address, userId) {
  const db = load();
  db.properties.push({ id, name, address, user_id: userId, created_at: new Date().toISOString() });
  save(db);
}

export function deleteProperty(id) {
  const db = load();
  const unitIds = db.units.filter(u => u.property_id === id).map(u => u.id);
  db.payments = db.payments.filter(p => !unitIds.includes(p.unit_id));
  db.units = db.units.filter(u => u.property_id !== id);
  db.properties = db.properties.filter(p => p.id !== id);
  save(db);
}

// ── Units ─────────────────────────────────────────────────────────────────────
export function getUnits(propertyId) {
  return load().units
    .filter(u => u.property_id === propertyId)
    .sort((a, b) => String(a.unit_number).localeCompare(String(b.unit_number)));
}

export function getUnit(id) {
  return load().units.find(u => u.id === id) || null;
}

export function insertUnit(unit) {
  const db = load();
  db.units.push({ ...unit, created_at: new Date().toISOString() });
  save(db);
}

export function updateUnit(unit) {
  const db = load();
  const idx = db.units.findIndex(u => u.id === unit.id);
  if (idx !== -1) {
    db.units[idx] = { ...db.units[idx], ...unit };
    save(db);
  }
}

export function deleteUnit(id) {
  const db = load();
  db.payments = db.payments.filter(p => p.unit_id !== id);
  db.units = db.units.filter(u => u.id !== id);
  save(db);
}

// ── Payments ──────────────────────────────────────────────────────────────────
export function getPayments(unitId) {
  return load().payments
    .filter(p => p.unit_id === unitId)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function getUpcomingPayments(userId) {
  const db = load();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const unitIds = _userUnitIds(db, userId);

  return db.payments
    .filter(p => unitIds.has(p.unit_id) && p.status === 'pending' && p.due_date >= today && p.due_date <= in30)
    .map(p => _enrichPayment(p, db))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function getOverduePayments(userId) {
  const db = load();
  const today = new Date().toISOString().slice(0, 10);
  const unitIds = _userUnitIds(db, userId);

  return db.payments
    .filter(p => unitIds.has(p.unit_id) && p.status === 'pending' && p.due_date < today)
    .map(p => _enrichPayment(p, db))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

function _userUnitIds(db, userId) {
  // If no userId provided, return all unit IDs (for scheduler/global use)
  if (!userId) return new Set(db.units.map(u => u.id));
  const propIds = new Set(db.properties.filter(p => p.user_id === userId).map(p => p.id));
  return new Set(db.units.filter(u => propIds.has(u.property_id)).map(u => u.id));
}

export function getAllPendingPayments(userId) {
  const db = load();
  const unitIds = _userUnitIds(db, userId);
  return db.payments
    .filter(p => unitIds.has(p.unit_id) && p.status === 'pending')
    .map(p => _enrichPayment(p, db))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

function _enrichPayment(p, db) {
  const unit = db.units.find(u => u.id === p.unit_id) || {};
  const prop = db.properties.find(pr => pr.id === unit.property_id) || {};
  return {
    ...p,
    unit_number: unit.unit_number || '',
    tenants_json: unit.tenants_json || '[]',
    property_name: prop.name || '',
    property_id: prop.id || ''
  };
}

export function insertPayment(payment) {
  const db = load();
  db.payments.push({ ...payment, created_at: new Date().toISOString() });
  save(db);
}

export function markPaymentCollected(id, method, collectedDate, chequeFilename, chequeNumber, notes) {
  const db = load();
  const idx = db.payments.findIndex(p => p.id === id);
  if (idx !== -1) {
    db.payments[idx] = {
      ...db.payments[idx],
      status: 'collected',
      method,
      collected_date: collectedDate,
      cheque_filename: chequeFilename || null,
      cheque_number: chequeNumber || null,
      notes: notes || null
    };
    save(db);
  }
}

export function updatePaymentCheque(id, chequeFilename, chequeNumber) {
  const db = load();
  const idx = db.payments.findIndex(p => p.id === id);
  if (idx !== -1) {
    db.payments[idx].cheque_filename = chequeFilename;
    db.payments[idx].cheque_number = chequeNumber;
    save(db);
  }
}

export function deletePaymentsForUnit(unitId) {
  const db = load();
  db.payments = db.payments.filter(p => p.unit_id !== unitId);
  save(db);
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function getSetting(key) {
  return load().settings[key] ?? null;
}

export function getAllSettings() {
  return { ...load().settings };
}

export function setSetting(key, value) {
  const db = load();
  db.settings[key] = value;
  save(db);
}

export function setSettings(obj) {
  const db = load();
  Object.assign(db.settings, obj);
  save(db);
}
