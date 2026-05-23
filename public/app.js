/* PropertyTrack — Frontend SPA */
'use strict';

const API = {
  _h() {
    const t = localStorage.getItem('pt_token');
    const h = { 'Content-Type': 'application/json' };
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  },
  async get(path) {
    const r = await fetch(path, { headers: this._h() });
    if (r.status === 401) { App.logout(); return null; }
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: this._h(), body: JSON.stringify(body) });
    if (r.status === 401) { App.logout(); return null; }
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, { method: 'PUT', headers: this._h(), body: JSON.stringify(body) });
    if (r.status === 401) { App.logout(); return null; }
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
  async delete(path) {
    const r = await fetch(path, { method: 'DELETE', headers: this._h() });
    if (r.status === 401) { App.logout(); return null; }
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
  async upload(path, formData) {
    const t = localStorage.getItem('pt_token');
    const h = t ? { 'Authorization': `Bearer ${t}` } : {};
    const r = await fetch(path, { method: 'POST', headers: h, body: formData });
    if (r.status === 401) { App.logout(); return null; }
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  }
};

// ── Utilities ─────────────────────────────────────────────────────────────────
const fmt = {
  currency(amount, currency = window._currency || 'AED') {
    return `${currency} ${Number(amount || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },
  date(d) {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
  },
  shortDate(d) {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
  },
  dayMonth(d) {
    if (!d) return { day: '—', month: '' };
    const [, m, day] = d.split('-');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return { day: parseInt(day), month: months[parseInt(m) - 1] };
  },
  initials(name) {
    return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  },
  tenantNames(tenantsJson) {
    try {
      const t = JSON.parse(tenantsJson || '[]');
      return t.map(x => x.name).filter(Boolean).join(', ') || 'No tenant';
    } catch { return 'No tenant'; }
  },
  paymentStatus(p) {
    if (p.status === 'collected') return { label: 'Collected', cls: 'badge-success', dot: 'collected' };
    const today = new Date().toISOString().slice(0, 10);
    if (p.due_date < today) return { label: 'Overdue', cls: 'badge-danger', dot: 'overdue' };
    const soon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    if (p.due_date <= soon) return { label: 'Due Soon', cls: 'badge-warning', dot: 'upcoming' };
    return { label: 'Pending', cls: 'badge-muted', dot: 'pending' };
  },
  frequency(f) {
    return { monthly: 'Monthly', 'every-two-months': 'Every 2 Months', quarterly: 'Quarterly' }[f] || f;
  },
  fileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
};

function toast(msg, type = '') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function icon(name) {
  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    cheque: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="15" x2="13" y2="15"/><line x1="17" y1="15" x2="17" y2="15"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" stroke="none"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" stroke="none"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" stroke="none"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" stroke="none"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>'
  };
  return icons[name] || '';
}

// ── State ─────────────────────────────────────────────────────────────────────
const State = {
  view: 'dashboard',
  history: [],
  properties: [],
  currentProperty: null,
  currentUnit: null,
  settings: {}
};

// ── Nav-param store: avoids quote-escaping bugs in onclick attributes ──────────
// Instead of embedding JSON in onclick="...", we store params here and reference by key.
const _nav = {};
let _navSeq = 0;
function nav(params) {
  const key = 'k' + (++_navSeq);
  _nav[key] = params;
  return key;
}

// ── Router ────────────────────────────────────────────────────────────────────
const App = {
  currentUser: null,

  showAuth(type = 'login') {
    document.body.classList.add('auth-mode');
    document.getElementById('appMain').innerHTML = type === 'register' ? Views.register() : Views.login();
  },

  logout() {
    localStorage.removeItem('pt_token');
    App.currentUser = null;
    toast('Logged out successfully');
    App.showAuth('login');
  },

  async navigate(view, params = {}) {
    document.body.classList.remove('auth-mode');
    State.history.push({ view: State.view, params: State.params });
    State.view = view;
    State.params = params;
    await App.render();
  },

  goBack() {
    if (State.history.length === 0) return App.navigate('dashboard');
    const prev = State.history.pop();
    State.view = prev.view;
    State.params = prev.params || {};
    App.render();
  },

  async render() {
    const main = document.getElementById('appMain');
    const btnBack = document.getElementById('btnBack');
    const headerTitle = document.getElementById('headerTitle');
    const btnAction = document.getElementById('btnHeaderAction');

    btnAction.style.display = 'none';
    btnAction.innerHTML = '';

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === State.view);
    });

    const topViews = ['dashboard', 'properties', 'payments', 'settings'];
    btnBack.style.display = topViews.includes(State.view) ? 'none' : 'flex';

    switch (State.view) {
      case 'dashboard':    headerTitle.textContent = 'PropertyTrack'; await Views.dashboard(main); break;
      case 'properties':   headerTitle.textContent = 'Properties'; await Views.properties(main); break;
      case 'payments':     headerTitle.textContent = 'All Payments'; await Views.allPayments(main); break;
      case 'settings':     headerTitle.textContent = 'Settings'; await Views.settings(main); break;
      case 'property':     headerTitle.textContent = State.params.name || 'Property'; await Views.property(main); break;
      case 'unit':         headerTitle.textContent = `Unit ${State.params.unitNumber || ''}`; await Views.unit(main); break;
      case 'addProperty':  headerTitle.textContent = 'Add Property'; Views.addProperty(main); break;
      case 'addUnit':      headerTitle.textContent = State.params.editing ? 'Edit Unit' : 'Add Unit'; Views.addUnit(main); break;
    }
  },

  openModal(title, bodyHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('open');
    document.getElementById('modal').classList.add('open');
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.getElementById('modal').classList.remove('open');
  }
};

// ── Views ─────────────────────────────────────────────────────────────────────
const Views = {

  // Login
  login: () => `
    <div class="auth-card">
      <div class="auth-logo">🏠</div>
      <h1 class="auth-title">PropertyTrack</h1>
      <p class="auth-subtitle">Sign in to your account</p>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-control" id="authEmail" type="email" placeholder="your@email.com" autocomplete="email" />
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-control" id="authPassword" type="password" placeholder="••••••••" autocomplete="current-password"
          onkeydown="if(event.key==='Enter')Actions.login()" />
      </div>
      <button class="btn btn-primary btn-full" id="authBtn" onclick="Actions.login()">Sign In</button>
      <p class="auth-switch">Don't have an account? <a href="#" onclick="event.preventDefault();App.showAuth('register')">Create one</a></p>
    </div>`,

  // Register
  register: () => `
    <div class="auth-card">
      <div class="auth-logo">🏠</div>
      <h1 class="auth-title">PropertyTrack</h1>
      <p class="auth-subtitle">Create your account</p>
      <div class="form-group">
        <label class="form-label">Your Name</label>
        <input class="form-control" id="authName" type="text" placeholder="e.g. John Smith" autocomplete="name" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-control" id="authEmail" type="email" placeholder="your@email.com" autocomplete="email" />
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-control" id="authPassword" type="password" placeholder="Min 6 characters" autocomplete="new-password"
          onkeydown="if(event.key==='Enter')Actions.register()" />
      </div>
      <button class="btn btn-primary btn-full" id="authBtn" onclick="Actions.register()">Create Account</button>
      <p class="auth-switch">Already have an account? <a href="#" onclick="event.preventDefault();App.showAuth('login')">Sign in</a></p>
    </div>`,

  // Dashboard
  async dashboard(el) {
    el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading dashboard…</p></div>`;
    try {
      const [props, { overdue, upcoming }] = await Promise.all([
        API.get('/api/properties'),
        API.get('/api/payments/upcoming')
      ]);
      window._currency = State.settings.currency || 'AED';

      const totalUnits = props.reduce((s, p) => s + (p.unitCount || 0), 0);
      const overdueAmount = overdue.reduce((s, p) => s + p.amount, 0);
      const upcomingAmount = upcoming.reduce((s, p) => s + p.amount, 0);

      const paymentRows = (list, dotClass) => list.map(p => {
        const tenants = fmt.tenantNames(p.tenants_json);
        return `<div class="payment-item">
          <div class="payment-dot ${dotClass}"></div>
          <div class="payment-info">
            <div class="payment-property">${p.property_name} · Unit ${p.unit_number}</div>
            <div class="payment-tenant">${tenants}</div>
            <div class="payment-due">${dotClass === 'overdue' ? 'Was due' : 'Due'} ${fmt.date(p.due_date)}</div>
          </div>
          <div>
            <div class="payment-amount ${dotClass === 'overdue' ? 'danger' : ''}" style="color:${dotClass === 'overdue' ? 'var(--danger)' : 'inherit'}">${fmt.currency(p.amount)}</div>
            <button class="btn btn-sm btn-primary" style="margin-top:6px;font-size:11px;padding:6px 10px" onclick="Modals.collectPayment('${p.id}')">Mark Paid</button>
          </div>
        </div>`;
      }).join('');

      el.innerHTML = `<div class="page">
        <div class="stat-grid">
          <div class="stat-card primary"><div class="stat-value">${props.length}</div><div class="stat-label">Properties</div></div>
          <div class="stat-card primary"><div class="stat-value">${totalUnits}</div><div class="stat-label">Units</div></div>
          <div class="stat-card ${overdue.length ? 'danger' : 'success'}"><div class="stat-value">${overdue.length}</div><div class="stat-label">Overdue</div></div>
          <div class="stat-card warning"><div class="stat-value">${upcoming.length}</div><div class="stat-label">Due This Week</div></div>
        </div>

        ${overdue.length > 0 ? `
        <div class="section-header"><h2 class="section-title" style="color:var(--danger)">Overdue Payments</h2></div>
        <div class="card" style="margin-bottom:16px">
          ${paymentRows(overdue, 'overdue')}
        </div>` : ''}

        ${upcoming.length > 0 ? `
        <div class="section-header"><h2 class="section-title" style="color:var(--warning)">Due This Week</h2></div>
        <div class="card" style="margin-bottom:16px">
          ${paymentRows(upcoming, 'upcoming')}
        </div>` : ''}

        ${overdue.length === 0 && upcoming.length === 0 ? `
        <div class="card" style="margin-bottom:16px">
          <div class="card-body" style="text-align:center;padding:32px">
            <div style="font-size:40px;margin-bottom:8px">✅</div>
            <div style="font-weight:600;font-size:16px;margin-bottom:4px">All caught up!</div>
            <div style="color:var(--text-muted);font-size:14px">No overdue or upcoming payments</div>
          </div>
        </div>` : ''}

        <!-- Quick Actions -->
        <div class="section-header"><h2 class="section-title">Quick Actions</h2></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <button class="card" style="border:none;cursor:pointer;padding:18px;text-align:center" onclick="Actions.quickUploadContract()">
            <div style="font-size:28px;margin-bottom:6px">📄</div>
            <div style="font-weight:600;font-size:13px">Upload Contract</div>
            <div style="color:var(--text-muted);font-size:11px;margin-top:2px">Add new tenant</div>
          </button>
          <button class="card" style="border:none;cursor:pointer;padding:18px;text-align:center" onclick="App.navigate('properties')">
            <div style="font-size:28px;margin-bottom:6px">🏠</div>
            <div style="font-weight:600;font-size:13px">Properties</div>
            <div style="color:var(--text-muted);font-size:11px;margin-top:2px">${props.length} propert${props.length !== 1 ? 'ies' : 'y'}</div>
          </button>
        </div>
      </div>`;
    } catch (e) {
      el.innerHTML = `<div class="page"><div class="alert alert-danger">${icon('alert')} ${e.message}</div></div>`;
    }
  },

  // Properties List
  async properties(el) {
    el.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    try {
      const props = await API.get('/api/properties');
      State.properties = props;

      if (props.length === 0) {
        el.innerHTML = `<div class="page">
          <div class="empty-state">
            ${icon('home')}
            <h3>No Properties Yet</h3>
            <p>Upload a rental contract and we'll extract all tenant details automatically — or add a property manually.</p>
            <button class="btn btn-accent btn-full" style="margin-bottom:10px" onclick="Actions.quickUploadContract()">
              ${icon('upload')} Upload Contract
            </button>
            <button class="btn btn-ghost btn-full" onclick="App.navigate('addProperty')">Add Property Manually</button>
          </div>
        </div>`;
      } else {
        // Use nav() store so property names with quotes/special chars never break onclick
        el.innerHTML = `<div class="page">
          ${props.map(p => {
            const k = nav({ id: p.id, name: p.name });
            return `<div class="property-card" onclick="App.navigate('property',_nav['${k}'])">
              <div class="property-card-header">
                <div class="property-name">${p.name}</div>
                <div class="property-address">${p.address || ''}</div>
              </div>
              <div class="property-card-body">
                <div class="property-meta"><strong>${p.unitCount}</strong> unit${p.unitCount !== 1 ? 's' : ''}</div>
                <button class="btn btn-sm btn-ghost" style="padding:6px 12px;font-size:12px"
                  onclick="event.stopPropagation();Modals.deleteProperty(_nav['${k}'].id,_nav['${k}'].name)">Delete</button>
              </div>
            </div>`;
          }).join('')}
        </div>`;
      }

      const fab = document.createElement('button');
      fab.className = 'fab';
      fab.innerHTML = icon('plus');
      fab.onclick = () => App.navigate('addProperty');
      el.appendChild(fab);
    } catch (e) {
      el.innerHTML = `<div class="page"><div class="alert alert-danger">${icon('alert')} ${e.message}</div></div>`;
    }
  },

  // Property Detail (units)
  async property(el) {
    const { id, name } = State.params;
    el.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    try {
      const units = await API.get(`/api/units?propertyId=${id}`);

      if (units.length === 0) {
        el.innerHTML = `<div class="page">
          <div class="empty-state">
            ${icon('home')}
            <h3>No Units Yet</h3>
            <p>Add a unit and upload the rental contract to auto-fill tenant details.</p>
            <button class="btn btn-primary" onclick="App.navigate('addUnit',_nav['${nav({ propertyId: id, propertyName: name })}'])">Add Unit</button>
          </div>
        </div>`;
      } else {
        el.innerHTML = `<div class="page">
          <div class="page-title">${name}</div>
          <div class="page-subtitle">${units.length} unit${units.length !== 1 ? 's' : ''}</div>
          ${units.map(u => {
            const k = nav({ unitId: u.id, unitNumber: u.unit_number, propertyId: id, propertyName: name });
            return `<div class="unit-card" onclick="App.navigate('unit',_nav['${k}'])">
              <div class="unit-card-header">
                <div>
                  <div class="unit-number">Unit ${u.unit_number}</div>
                  <div class="unit-tenants">${fmt.tenantNames(u.tenants_json)}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700;font-size:16px;color:var(--primary)">${fmt.currency(u.rent_amount)}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${fmt.frequency(u.payment_frequency)}</div>
                </div>
              </div>
              <div class="unit-card-body">
                <div class="unit-stat"><label>From</label>${fmt.date(u.contract_start)}</div>
                <div class="unit-stat"><label>To</label>${fmt.date(u.contract_end)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>`;
      }

      const fab = document.createElement('button');
      fab.className = 'fab';
      fab.innerHTML = icon('plus');
      fab.onclick = () => App.navigate('addUnit', { propertyId: id, propertyName: name });
      el.appendChild(fab);
    } catch (e) {
      el.innerHTML = `<div class="page"><div class="alert alert-danger">${icon('alert')} ${e.message}</div></div>`;
    }
  },

  // Unit Detail (payments timeline)
  async unit(el) {
    const { unitId, unitNumber, propertyId, propertyName } = State.params;
    el.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    try {
      const [unit, payments] = await Promise.all([
        API.get(`/api/units?propertyId=${propertyId}`).then(us => us.find(u => u.id === unitId)),
        API.get(`/api/payments?unitId=${unitId}`)
      ]);

      if (!unit) throw new Error('Unit not found');
      const tenants = JSON.parse(unit.tenants_json || '[]');
      const collected = payments.filter(p => p.status === 'collected').length;
      const pending = payments.filter(p => p.status === 'pending').length;

      const editKey = nav({ propertyId, propertyName, editing: true, unitData: unit });
      const delUnitKey = nav({ unitId: unit.id, unitNumber: unit.unit_number, propertyId, propertyName });

      el.innerHTML = `<div class="page">

        <!-- Tenant Info -->
        <div class="section-header">
          <h2 class="section-title">Tenants</h2>
          <button class="btn btn-sm btn-ghost" onclick="App.navigate('addUnit',_nav['${editKey}'])">Edit</button>
        </div>
        ${tenants.length === 0 ? '<p style="color:var(--text-muted);font-size:14px;margin-bottom:16px">No tenant info</p>' :
          tenants.map(t => `<div class="tenant-chip">
            <div class="tenant-avatar">${fmt.initials(t.name)}</div>
            <div>
              <div class="tenant-name">${t.name || '—'}</div>
              <div class="tenant-contact">${[t.phone, t.email].filter(Boolean).join(' · ') || '—'}</div>
            </div>
          </div>`).join('')}

        <!-- Contract Info -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px">
              <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">CONTRACT PERIOD</div>
                <div style="font-weight:600">${fmt.date(unit.contract_start)} → ${fmt.date(unit.contract_end)}</div></div>
              <div style="text-align:right"><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">RENT</div>
                <div style="font-weight:700;color:var(--primary)">${fmt.currency(unit.rent_amount)}</div>
                <div style="font-size:11px;color:var(--text-muted)">${fmt.frequency(unit.payment_frequency)}</div></div>
            </div>
            ${unit.contract_filename ? `<div class="file-preview" style="margin-top:12px" onclick="window.open('/api/files/${unit.contract_filename}','_blank')">
              ${icon('file')}<div><div class="file-preview-name">Contract Document</div><div class="file-preview-size">Tap to view</div></div>
            </div>` : ''}
          </div>
        </div>

        <!-- Payment Summary -->
        <div class="stat-grid" style="margin-bottom:16px">
          <div class="stat-card success"><div class="stat-value">${collected}</div><div class="stat-label">Collected</div></div>
          <div class="stat-card ${pending > 0 ? 'warning' : 'success'}"><div class="stat-value">${pending}</div><div class="stat-label">Pending</div></div>
        </div>

        <!-- Payment Timeline -->
        <div class="section-header"><h2 class="section-title">Payment Schedule</h2></div>
        <div class="card" style="margin-bottom:16px">
          ${payments.length === 0 ? '<div class="card-body" style="text-align:center;color:var(--text-muted);font-size:14px;padding:24px">No payments scheduled</div>' :
            `<div class="timeline">
              ${payments.map(p => {
                const status = fmt.paymentStatus(p);
                const dm = fmt.dayMonth(p.due_date);
                return `<div class="timeline-item">
                  <div class="timeline-date">
                    <div class="day">${dm.day}</div>
                    <div class="month">${dm.month}</div>
                  </div>
                  <div class="timeline-content">
                    <div class="timeline-amount">${fmt.currency(p.amount)}</div>
                    <div class="timeline-period">${fmt.date(p.period_start)} → ${fmt.date(p.period_end)}</div>
                    <div class="timeline-status">
                      <span class="badge ${status.cls}">${status.label}</span>
                      ${p.status === 'collected' ? `<span style="font-size:12px;color:var(--text-muted)">${p.method ? p.method.replace('_',' ') : ''} · ${fmt.date(p.collected_date)}</span>` : ''}
                      ${p.status !== 'collected' ? `<button class="btn btn-sm btn-success" style="font-size:11px;padding:4px 10px" onclick="Modals.collectPayment('${p.id}')">Mark Paid</button>` : ''}
                    </div>
                    ${p.cheque_number ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Cheque #${p.cheque_number}</div>` : ''}
                  </div>
                </div>`;
              }).join('')}
            </div>`}
        </div>

        <button class="btn btn-danger btn-full" onclick="Modals.deleteUnit(_nav['${delUnitKey}'].unitId,_nav['${delUnitKey}'].unitNumber,_nav['${delUnitKey}'].propertyId,_nav['${delUnitKey}'].propertyName)">Delete Unit</button>
      </div>`;
    } catch (e) {
      el.innerHTML = `<div class="page"><div class="alert alert-danger">${icon('alert')} ${e.message}</div></div>`;
    }
  },

  // All Payments View
  async allPayments(el) {
    el.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    try {
      const props = await API.get('/api/properties');
      const allPayments = [];

      for (const p of props) {
        const units = await API.get(`/api/units?propertyId=${p.id}`);
        for (const u of units) {
          const payments = await API.get(`/api/payments?unitId=${u.id}`);
          payments.forEach(pay => allPayments.push({ ...pay, propertyName: p.name, unitNumber: u.unit_number, tenantsJson: u.tenants_json }));
        }
      }

      allPayments.sort((a, b) => a.due_date.localeCompare(b.due_date));

      if (allPayments.length === 0) {
        el.innerHTML = `<div class="page"><div class="empty-state">${icon('cash')}<h3>No Payments</h3><p>Add properties and units to generate payment schedules.</p></div></div>`;
        return;
      }

      // Filter state
      let filter = 'all';
      const render = () => {
        const filtered = filter === 'all' ? allPayments : allPayments.filter(p => {
          if (filter === 'overdue') { const today = new Date().toISOString().slice(0,10); return p.status === 'pending' && p.due_date < today; }
          if (filter === 'pending') return p.status === 'pending';
          if (filter === 'collected') return p.status === 'collected';
          return true;
        });

        const list = filtered.map(p => {
          const status = fmt.paymentStatus(p);
          return `<div class="payment-item">
            <div class="payment-dot ${status.dot}"></div>
            <div class="payment-info">
              <div class="payment-property">${p.propertyName} · Unit ${p.unitNumber}</div>
              <div class="payment-tenant">${fmt.tenantNames(p.tenantsJson)}</div>
              <div class="payment-due">${fmt.date(p.due_date)} · <span class="badge ${status.cls}" style="font-size:11px">${status.label}</span>
              ${p.status === 'collected' && p.method ? ` · ${p.method.replace('_',' ')}` : ''}</div>
            </div>
            <div>
              <div class="payment-amount">${fmt.currency(p.amount)}</div>
              ${p.status !== 'collected' ? `<button class="btn btn-sm btn-success" style="margin-top:6px;font-size:11px;padding:5px 10px" onclick="Modals.collectPayment('${p.id}')">Mark Paid</button>` : ''}
            </div>
          </div>`;
        }).join('') || '<div style="text-align:center;padding:24px;color:var(--text-muted)">No payments in this filter</div>';

        document.getElementById('paymentList').innerHTML = list;
      };

      el.innerHTML = `<div class="page">
        <div style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px">
          ${['all','pending','overdue','collected'].map(f => `
            <button class="btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}" style="white-space:nowrap" onclick="
              document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('btn-primary'));
              document.querySelectorAll('.filter-btn').forEach(b=>b.classList.add('btn-ghost'));
              this.classList.remove('btn-ghost');this.classList.add('btn-primary');
              window._payFilter='${f}';window._renderPayments();"
              class="filter-btn btn btn-sm ${f === 'all' ? 'btn-primary' : 'btn-ghost'}">${f.charAt(0).toUpperCase()+f.slice(1)}</button>
          `).join('')}
        </div>
        <div class="card"><div id="paymentList"></div></div>
      </div>`;

      window._payFilter = 'all';
      window._renderPayments = () => {
        const f = window._payFilter;
        const today = new Date().toISOString().slice(0,10);
        const filtered = f === 'all' ? allPayments : allPayments.filter(p => {
          if (f === 'overdue') return p.status === 'pending' && p.due_date < today;
          if (f === 'pending') return p.status === 'pending';
          if (f === 'collected') return p.status === 'collected';
          return true;
        });
        document.getElementById('paymentList').innerHTML = filtered.map(p => {
          const status = fmt.paymentStatus(p);
          return `<div class="payment-item">
            <div class="payment-dot ${status.dot}"></div>
            <div class="payment-info">
              <div class="payment-property">${p.propertyName} · Unit ${p.unitNumber}</div>
              <div class="payment-tenant">${fmt.tenantNames(p.tenantsJson)}</div>
              <div class="payment-due">${fmt.date(p.due_date)} · <span class="badge ${status.cls}" style="font-size:11px">${status.label}</span>${p.status === 'collected' && p.method ? ` · ${p.method.replace('_',' ')}` : ''}</div>
            </div>
            <div>
              <div class="payment-amount">${fmt.currency(p.amount)}</div>
              ${p.status !== 'collected' ? `<button class="btn btn-sm btn-success" style="margin-top:6px;font-size:11px;padding:5px 10px" onclick="Modals.collectPayment('${p.id}')">Mark Paid</button>` : ''}
            </div>
          </div>`;
        }).join('') || '<div style="text-align:center;padding:24px;color:var(--text-muted)">No payments in this filter</div>';
      };
      window._renderPayments();
    } catch (e) {
      el.innerHTML = `<div class="page"><div class="alert alert-danger">${icon('alert')} ${e.message}</div></div>`;
    }
  },

  // Add Property Form
  addProperty(el) {
    el.innerHTML = `<div class="page">
      <div class="form-group">
        <label class="form-label">Property Name *</label>
        <input class="form-control" id="propName" placeholder="e.g. Sunset Apartments, 123 Main St" />
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <input class="form-control" id="propAddress" placeholder="Full address" />
      </div>
      <button class="btn btn-primary btn-full" id="savePropBtn" onclick="Actions.saveProperty()">Save Property</button>
    </div>`;
  },

  // Add / Edit Unit Form
  addUnit(el) {
    const { propertyId, propertyName, editing, unitData } = State.params;
    const u = editing && unitData ? (typeof unitData === 'string' ? JSON.parse(unitData) : unitData) : null;
    const tenants = u ? JSON.parse(u.tenants_json || '[]') : [{ name: '', email: '', phone: '' }];

    el.innerHTML = `<div class="page">

      ${editing ? '' : `
      <!-- Contract Upload -->
      <div class="section-header"><h2 class="section-title">Upload Contract</h2></div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-body">

          <!-- FILE input FIRST — label wraps the zone so any tap opens the picker (works on iOS Safari) -->
          <input type="file" id="contractInput" accept=".pdf,.png,.jpg,.jpeg,.webp"
            style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"
            onchange="Actions.uploadContract(this.files[0])">

          <label for="contractInput" class="upload-zone" id="contractZone" style="cursor:pointer;display:block">
            ${icon('upload')}
            <h4>Tap to upload contract</h4>
            <p>PDF or image — AI will extract all details automatically</p>
          </label>

          <div class="or-divider" style="margin:12px 0"><span>or choose source</span></div>

          <div class="upload-sources">
            <label for="contractInput" class="upload-source-btn" style="cursor:pointer">
              ${icon('file')} <span>Device / iCloud</span>
            </label>
            <button type="button" class="upload-source-btn" onclick="Actions.openGoogleDrive()">
              ${icon('drive')} <span>Google Drive</span>
            </button>
          </div>

          <div id="contractStatus" style="margin-top:10px"></div>
          <div id="extractedBanner" style="display:none;margin-top:10px" class="extracted-banner">
            ${icon('check')} Contract details extracted — review and confirm below
          </div>
        </div>
      </div>`}

      <!-- Unit Details -->
      <div class="section-header"><h2 class="section-title">Unit Details</h2></div>

      <input type="hidden" id="contractFilename" value="${u?.contract_filename || ''}">

      <div class="form-group">
        <label class="form-label">Unit Number *</label>
        <input class="form-control" id="unitNumber" value="${u?.unit_number || ''}" placeholder="e.g. 101, A, Ground Floor" />
      </div>

      <!-- Tenants -->
      <div class="section-header" style="margin-top:4px">
        <h2 class="section-title">Tenants</h2>
        <button class="btn btn-sm btn-ghost" onclick="Actions.addTenant()">+ Add</button>
      </div>
      <div id="tenantsContainer">
        ${tenants.map((t, i) => Views._tenantRow(t, i)).join('')}
      </div>

      <!-- Contract Dates & Rent -->
      <div class="section-header" style="margin-top:8px"><h2 class="section-title">Contract & Rent</h2></div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start Date *</label>
          <input class="form-control" type="date" id="contractStart" value="${u?.contract_start || ''}" onchange="Actions.refreshPaymentSlots()" />
        </div>
        <div class="form-group">
          <label class="form-label">End Date *</label>
          <input class="form-control" type="date" id="contractEnd" value="${u?.contract_end || ''}" onchange="Actions.refreshPaymentSlots()" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Total Annual Rent (as in contract) *</label>
        <div style="position:relative">
          <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;pointer-events:none">AED</span>
          <input class="form-control" type="number" id="annualRent" value="${u ? Math.round(u.rent_amount * {monthly:12,'every-two-months':6,quarterly:4}[u.payment_frequency||'monthly']) : ''}" placeholder="e.g. 33000" style="padding-left:50px" oninput="Actions.recalcRent()" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Payment Frequency</label>
          <select class="form-control" id="payFreq" onchange="Actions.recalcRent()">
            ${['monthly','every-two-months','quarterly'].map(f =>
              `<option value="${f}" ${(u?.payment_frequency || 'monthly') === f ? 'selected' : ''}>${fmt.frequency(f)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Per Payment</label>
          <div style="position:relative">
            <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;pointer-events:none">AED</span>
            <input class="form-control" type="number" id="rentAmount" value="${u?.rent_amount || ''}" placeholder="Auto" readonly style="padding-left:50px;background:var(--bg);font-weight:600;color:var(--primary)" />
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Payment Due Day (of month)</label>
        <input class="form-control" type="number" id="payDueDay" min="1" max="31" value="${u?.payment_due_day || 1}" onchange="Actions.refreshPaymentSlots()" />
        <div class="form-hint">e.g. 1 = 1st of each month</div>
      </div>

      <!-- Payment Slots with Cheque Uploads (generated dynamically) -->
      <div id="paymentSlots"></div>

      <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="Actions.saveUnit(${editing ? `'${u.id}'` : 'null'}, '${propertyId}')">
        ${editing ? 'Update Unit' : 'Save & Generate Schedule'}
      </button>
    </div>`;

    window._tenantCount = tenants.length;
    window._chequeUploads = {}; // reset for new form
  },

  _tenantRow(t, i) {
    return `<div class="card" style="margin-bottom:10px" id="tenantRow${i}">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-weight:600;font-size:13px;color:var(--text-muted)">TENANT ${i + 1}</div>
          ${i > 0 ? `<button class="btn btn-sm" style="color:var(--danger);background:none;border:none;padding:0;font-size:13px" onclick="document.getElementById('tenantRow${i}').remove()">Remove</button>` : ''}
        </div>
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-control tenant-name" placeholder="Tenant name" value="${t.name || ''}"/></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Phone</label><input class="form-control tenant-phone" type="tel" placeholder="+971..." value="${t.phone || ''}"/></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-control tenant-email" type="email" placeholder="email@..." value="${t.email || ''}"/></div>
        </div>
      </div>
    </div>`;
  },

  // Settings
  async settings(el) {
    try {
      const s = await API.get('/api/settings');
      State.settings = s;
      window._currency = s.currency || 'AED';

      el.innerHTML = `<div class="page">

        <div class="settings-section">
          <div class="settings-section-title">AI Extraction</div>
          <div class="settings-item">
            <div class="form-group" style="margin:0">
              <label class="form-label">Anthropic API Key</label>
              <input class="form-control" id="s_apiKey" type="password" value="${s.anthropic_api_key || ''}" placeholder="sk-ant-..." />
              <div class="form-hint">Required for contract and cheque extraction. <a href="https://console.anthropic.com" target="_blank" style="color:var(--primary)">Get a key →</a></div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Currency</div>
          <div class="settings-item">
            <div class="form-group" style="margin:0">
              <label class="form-label">Currency Code</label>
              <input class="form-control" id="s_currency" value="${s.currency || 'AED'}" placeholder="AED, USD, GBP..." maxlength="5"/>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Email Reminders</div>
          <div class="settings-item">
            <div class="form-group" style="margin-bottom:12px">
              <label class="form-label">SMTP Host</label>
              <input class="form-control" id="s_emailHost" value="${s.email_host || 'smtp.gmail.com'}" placeholder="smtp.gmail.com"/>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Port</label>
                <input class="form-control" id="s_emailPort" value="${s.email_port || '587'}" placeholder="587"/>
              </div>
              <div class="form-group">
                <label class="form-label">From Email</label>
                <input class="form-control" id="s_emailUser" type="email" value="${s.email_user || ''}" placeholder="you@gmail.com"/>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">App Password</label>
              <input class="form-control" id="s_emailPass" type="password" value="${s.email_pass || ''}" placeholder="Gmail App Password"/>
              <div class="form-hint">Use a Gmail App Password, not your regular password. <a href="https://myaccount.google.com/apppasswords" target="_blank" style="color:var(--primary)">Create one →</a></div>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">Send Reminders To</label>
              <input class="form-control" id="s_emailRecipient" type="email" value="${s.email_recipient || ''}" placeholder="your@email.com"/>
            </div>
          </div>
          <div class="settings-item" style="display:flex;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="Actions.testEmail()">Send Test</button>
            <button class="btn btn-ghost btn-sm" onclick="Actions.sendReminderNow()">Send Reminder Now</button>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Google Drive (Optional)</div>
          <div class="settings-item">
            <div class="form-group" style="margin-bottom:12px">
              <label class="form-label">OAuth Client ID</label>
              <input class="form-control" id="s_gClientId" value="${s.google_client_id || ''}" placeholder="xxx.apps.googleusercontent.com"/>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">API Key</label>
              <input class="form-control" id="s_gApiKey" value="${s.google_api_key || ''}" placeholder="AIza..."/>
              <div class="form-hint">Create at <a href="https://console.cloud.google.com" target="_blank" style="color:var(--primary)">Google Cloud Console</a> → APIs & Services → Credentials</div>
            </div>
          </div>
        </div>

        <button class="btn btn-primary btn-full" onclick="Actions.saveSettings()">Save Settings</button>

        ${App.currentUser ? `
        <div class="settings-section" style="margin-top:16px">
          <div class="settings-section-title">Account</div>
          <div class="settings-item" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <div>
              <div style="font-weight:600;font-size:15px">${App.currentUser.name}</div>
              <div style="font-size:13px;color:var(--text-muted)">${App.currentUser.email}</div>
            </div>
            <button class="btn btn-sm btn-ghost" style="color:var(--danger);border-color:var(--danger);flex-shrink:0" onclick="App.logout()">Log Out</button>
          </div>
        </div>` : ''}

        <div style="height:16px"></div>
      </div>`;
    } catch (e) {
      el.innerHTML = `<div class="page"><div class="alert alert-danger">${icon('alert')} ${e.message}</div></div>`;
    }
  }
};

// ── Actions ───────────────────────────────────────────────────────────────────
const Actions = {

  // Auth
  async login() {
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value;
    if (!email || !password) return toast('Enter your email and password', 'warning');
    const btn = document.getElementById('authBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await r.json();
      if (!r.ok) { toast(data.error || 'Login failed', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; } return; }
      localStorage.setItem('pt_token', data.token);
      App.currentUser = data.user;
      document.body.classList.remove('auth-mode');
      State.settings = await API.get('/api/settings') || {};
      window._currency = State.settings.currency || 'AED';
      App.navigate('dashboard');
      toast(`Welcome back, ${data.user.name}! 👋`, 'success');
    } catch (e) {
      toast('Connection error — try again', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    }
  },

  async register() {
    const name = document.getElementById('authName')?.value.trim();
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value;
    if (!email || !password) return toast('Enter your email and password', 'warning');
    if (password.length < 6) return toast('Password must be at least 6 characters', 'warning');
    const btn = document.getElementById('authBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }
    try {
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) });
      const data = await r.json();
      if (!r.ok) { toast(data.error || 'Registration failed', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; } return; }
      localStorage.setItem('pt_token', data.token);
      App.currentUser = data.user;
      document.body.classList.remove('auth-mode');
      State.settings = await API.get('/api/settings') || {};
      window._currency = State.settings.currency || 'AED';
      App.navigate('dashboard');
      toast(`Welcome to PropertyTrack, ${data.user.name}! 🎉`, 'success');
    } catch (e) {
      toast('Connection error — try again', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
    }
  },

  // Dashboard "Upload Contract" quick-action
  async quickUploadContract() {
    let props = [];
    try { props = await API.get('/api/properties'); } catch {}

    if (props.length === 0) {
      // No properties yet — ask for one first then jump to addUnit
      App.openModal('Quick Upload Contract', `
        <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px">
          First, give this property a name so we know where to file the contract.
        </p>
        <div class="form-group">
          <label class="form-label">Property Name *</label>
          <input class="form-control" id="quickPropName" placeholder="e.g. Sunset Apartments" autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Address (optional)</label>
          <input class="form-control" id="quickPropAddr" placeholder="Full address" />
        </div>
        <button class="btn btn-accent btn-full" onclick="Actions._quickCreateAndUpload()">
          Continue to Upload →
        </button>
      `);
    } else if (props.length === 1) {
      // Only one property — go straight to addUnit
      App.closeModal();
      App.navigate('addUnit', { propertyId: props[0].id, propertyName: props[0].name });
    } else {
      // Multiple properties — let user pick
      App.openModal('Which Property?', `
        <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px">Select the property this contract belongs to:</p>
        ${props.map(p => `
          <button class="card" style="width:100%;border:none;cursor:pointer;padding:14px 16px;margin-bottom:8px;text-align:left;display:flex;align-items:center;justify-content:space-between"
            onclick="App.closeModal();App.navigate('addUnit',{propertyId:'${p.id}',propertyName:'${p.name}'})">
            <div>
              <div style="font-weight:600">${p.name}</div>
              <div style="font-size:12px;color:var(--text-muted)">${p.address || ''} · ${p.unitCount} unit${p.unitCount !== 1 ? 's' : ''}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        `).join('')}
        <button class="btn btn-ghost btn-full" style="margin-top:4px" onclick="App.closeModal();App.navigate('addProperty')">+ Add New Property</button>
      `);
    }
  },

  async _quickCreateAndUpload() {
    const name = document.getElementById('quickPropName')?.value.trim();
    if (!name) { toast('Property name is required', 'warning'); return; }
    const address = document.getElementById('quickPropAddr')?.value.trim() || '';
    try {
      const p = await API.post('/api/properties', { name, address });
      App.closeModal();
      App.navigate('addUnit', { propertyId: p.id, propertyName: p.name });
    } catch (e) { toast(e.message, 'error'); }
  },

  async saveProperty() {
    const name = document.getElementById('propName').value.trim();
    const address = document.getElementById('propAddress').value.trim();
    if (!name) { toast('Property name is required', 'error'); return; }
    const btn = document.getElementById('savePropBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await API.post('/api/properties', { name, address });
      toast('Property added!', 'success');
      App.navigate('properties');
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Save Property'; }
  },

  async uploadContract(file) {
    if (!file) return;
    const status = document.getElementById('contractStatus');
    const banner = document.getElementById('extractedBanner');
    status.innerHTML = `<div class="file-preview">${icon('file')}<div><div class="file-preview-name">${file.name}</div><div class="file-preview-size">Extracting with AI…</div></div><div class="spinner" style="width:20px;height:20px;margin:0 0 0 auto;border-width:2px"></div></div>`;
    banner.style.display = 'none';

    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data, filename } = await API.upload('/api/extract/contract', fd);
      document.getElementById('contractFilename').value = filename;
      Actions._fillExtracted(data);
      banner.style.display = 'flex';
      status.innerHTML = '';
      toast('Contract extracted!', 'success');
    } catch (e) {
      status.innerHTML = `<div class="alert alert-warning" style="margin-top:0">${icon('alert')} Could not auto-extract: ${e.message}. Fill in details manually.</div>`;
    }
  },

  _fillExtracted(data) {
    if (data.unitNumber) { const el = document.getElementById('unitNumber'); if (el) el.value = data.unitNumber; }
    if (data.contractStartDate) { const el = document.getElementById('contractStart'); if (el) el.value = data.contractStartDate; }
    if (data.contractEndDate) { const el = document.getElementById('contractEnd'); if (el) el.value = data.contractEndDate; }
    if (data.paymentFrequency) { const el = document.getElementById('payFreq'); if (el) el.value = data.paymentFrequency; }
    if (data.paymentDueDay) { const el = document.getElementById('payDueDay'); if (el) el.value = data.paymentDueDay; }
    if (data.annualRent) {
      const el = document.getElementById('annualRent');
      if (el) el.value = data.annualRent;
    }
    // Recalc per-payment amount + refresh slots (works even if annualRent was already set)
    Actions.recalcRent();

    if (data.tenants && data.tenants.length > 0) {
      const container = document.getElementById('tenantsContainer');
      if (container) {
        container.innerHTML = data.tenants.map((t, i) => Views._tenantRow(t, i)).join('');
        window._tenantCount = data.tenants.length;
      }
    }
  },

  recalcRent() {
    const annual = parseFloat(document.getElementById('annualRent')?.value || 0);
    const freq = document.getElementById('payFreq')?.value || 'monthly';
    const periodsPerYear = { monthly: 12, 'every-two-months': 6, quarterly: 4 };
    const periods = periodsPerYear[freq] || 12;
    const el = document.getElementById('rentAmount');
    if (el) el.value = annual > 0 ? (Math.round((annual / periods) * 100) / 100).toFixed(2) : '';
    Actions.refreshPaymentSlots();
  },

  refreshPaymentSlots() {
    const slotsDiv = document.getElementById('paymentSlots');
    if (!slotsDiv) return;
    const startVal = document.getElementById('contractStart')?.value;
    const endVal   = document.getElementById('contractEnd')?.value;
    const freq     = document.getElementById('payFreq')?.value || 'monthly';
    const dueDay   = parseInt(document.getElementById('payDueDay')?.value || 1);
    const annual   = parseFloat(document.getElementById('annualRent')?.value || 0);
    if (!startVal || !endVal || !annual) { slotsDiv.innerHTML = ''; return; }

    // Generate schedule preview (mirrors server logic)
    const [sy,sm,sd] = startVal.split('-').map(Number);
    const [ey,em,ed] = endVal.split('-').map(Number);
    const start = new Date(sy, sm-1, sd), end = new Date(ey, em-1, ed);
    const stepMap = { monthly:1, 'every-two-months':2, quarterly:3 };
    const step = stepMap[freq] || 1;
    const periodsPerYear = { monthly:12, 'every-two-months':6, quarterly:4 };
    const amount = Math.round((annual / (periodsPerYear[freq]||12)) * 100) / 100;
    const ld = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const slots = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), dueDay||1);
    if (cur < start) cur.setMonth(cur.getMonth() + step);
    while (cur <= end) { slots.push(ld(cur)); cur.setMonth(cur.getMonth()+step); }
    if (!slots.length) { slotsDiv.innerHTML = ''; return; }

    window._chequeUploads = window._chequeUploads || {};
    const uploaded = Object.keys(window._chequeUploads).length;
    slotsDiv.innerHTML = `
      <div class="section-header" style="margin-top:16px">
        <h2 class="section-title">Cheques / Payments <span style="font-size:12px;font-weight:400;color:var(--text-muted)">(${slots.length} payments${uploaded ? ` · ${uploaded} cheque${uploaded!==1?'s':''} uploaded` : ''})</span></h2>
      </div>

      <!-- Bulk upload option -->
      <div class="card" style="margin-bottom:10px">
        <div class="card-body" style="padding:14px 16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px">📂 Upload All Cheques at Once</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Select all ${slots.length} cheque photos together — AI reads each one and assigns them in date order.</div>
          <input type="file" id="bulkChequeInput" accept="image/*,.pdf" multiple
            style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"
            onchange="Actions.uploadAllCheques(this.files)">
          <label for="bulkChequeInput" class="btn btn-primary btn-full" style="display:block;text-align:center;cursor:pointer" id="bulkUploadBtn">
            📂 Select All Cheque Photos
          </label>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">or upload one by one</span>
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>

      <!-- Individual slots -->
      <div class="card" style="margin-bottom:8px">
        <div class="card-body" style="padding:0">
          ${slots.map((date, i) => {
            const cu = window._chequeUploads[i];
            return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;${i < slots.length-1 ? 'border-bottom:1px solid var(--border)' : ''}">
              <div style="width:32px;height:32px;border-radius:50%;background:${cu ? 'var(--success)' : 'var(--primary)'};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${cu ? '✓' : i+1}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px">${fmt.currency(amount)}</div>
                <div style="font-size:11px;color:var(--text-muted)">${fmt.date(date)}</div>
                ${cu ? `<div style="font-size:11px;color:var(--success);font-weight:600;margin-top:2px">
                  Cheque${cu.chequeNumber ? ' #'+cu.chequeNumber : ''}${cu.chequeDate ? ' · '+fmt.date(cu.chequeDate) : ''}
                </div>` : ''}
              </div>
              <div id="chequeSlot${i}" style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                <input type="file" id="chequeFile${i}" accept="image/*,.pdf"
                  style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"
                  onchange="Actions.uploadChequeForSlot(${i},this.files[0])">
                <label for="chequeFile${i}" class="btn btn-sm ${cu ? 'btn-ghost' : 'btn-ghost'}" style="font-size:11px;padding:4px 10px;cursor:pointer">
                  ${cu ? '↩ Replace' : '📷 Upload'}
                </label>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;padding:0 2px">You can save without uploading cheques and add them later from the payment schedule.</div>`;
  },

  async uploadChequeForSlot(idx, file) {
    if (!file) return;
    const slotDiv = document.getElementById(`chequeSlot${idx}`);
    const label = slotDiv?.querySelector('label');
    if (label) { label.innerHTML = '⏳ Reading…'; label.style.pointerEvents = 'none'; }
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data, filename } = await API.upload('/api/extract/cheque', fd);
      window._chequeUploads = window._chequeUploads || {};
      window._chequeUploads[idx] = { filename, chequeNumber: data.chequeNumber || '', chequeDate: data.date || null, amount: data.amount || null };
      toast(`Cheque ${idx+1}: #${data.chequeNumber || 'read'}${data.date ? ' · ' + fmt.date(data.date) : ''}`, 'success');
      Actions.refreshPaymentSlots(); // re-render slots with updated state
    } catch(e) {
      if (label) { label.innerHTML = '📷 Upload'; label.style.pointerEvents = 'auto'; }
      toast('Could not read cheque: ' + e.message, 'warning');
    }
  },

  async uploadAllCheques(files) {
    if (!files || files.length === 0) return;
    const btn = document.getElementById('bulkUploadBtn');
    if (btn) { btn.innerHTML = `⏳ Reading ${files.length} cheque${files.length!==1?'s':''}…`; btn.style.pointerEvents = 'none'; }

    try {
      // Process all cheques in parallel
      const results = await Promise.all([...files].map(async (file) => {
        const fd = new FormData();
        fd.append('file', file);
        const { data, filename } = await API.upload('/api/extract/cheque', fd);
        return { data, filename };
      }));

      // Sort by cheque date so they map to slots in chronological order
      results.sort((a, b) => {
        const da = a.data.date || '9999-99-99';
        const db = b.data.date || '9999-99-99';
        return da.localeCompare(db);
      });

      // Assign each cheque to its slot in order
      window._chequeUploads = {};
      results.forEach((r, i) => {
        window._chequeUploads[i] = {
          filename: r.filename,
          chequeNumber: r.data.chequeNumber || '',
          chequeDate: r.data.date || null,
          amount: r.data.amount || null
        };
      });

      const n = results.length;
      toast(`${n} cheque${n!==1?'s':''} processed and matched to slots!`, 'success');
      Actions.refreshPaymentSlots();
    } catch(e) {
      if (btn) { btn.innerHTML = '📂 Select All Cheque Photos'; btn.style.pointerEvents = 'auto'; }
      toast('Error reading cheques: ' + e.message, 'error');
    }
  },

  addTenant() {
    const i = window._tenantCount || 1;
    window._tenantCount = i + 1;
    const container = document.getElementById('tenantsContainer');
    const div = document.createElement('div');
    div.innerHTML = Views._tenantRow({ name: '', email: '', phone: '' }, i);
    container.appendChild(div.firstChild);
  },

  async saveUnit(unitId, propertyId) {
    const unitNumber = document.getElementById('unitNumber')?.value.trim();
    const contractStart = document.getElementById('contractStart')?.value;
    const contractEnd = document.getElementById('contractEnd')?.value;
    const rentAmount = parseFloat(document.getElementById('rentAmount')?.value || 0);
    const paymentFrequency = document.getElementById('payFreq')?.value || 'monthly';
    const paymentDueDay = parseInt(document.getElementById('payDueDay')?.value || 1);
    const contractFilename = document.getElementById('contractFilename')?.value || null;

    if (!unitNumber) { toast('Unit number is required', 'error'); return; }

    const tenants = [...document.querySelectorAll('#tenantsContainer .tenant-name')].map((el, i) => ({
      name: el.value.trim(),
      phone: document.querySelectorAll('#tenantsContainer .tenant-phone')[i]?.value.trim() || '',
      email: document.querySelectorAll('#tenantsContainer .tenant-email')[i]?.value.trim() || ''
    })).filter(t => t.name);

    const payload = { propertyId, unitNumber, tenants, contractStart, contractEnd, rentAmount, paymentFrequency, paymentDueDay, contractFilename };

    try {
      if (unitId) {
        await API.put(`/api/units/${unitId}`, payload);
        toast('Unit updated!', 'success');
        App.navigate('unit', { unitId, unitNumber, propertyId, propertyName: State.params.propertyName });
      } else {
        const result = await API.post('/api/units', payload);

        // Link uploaded cheques to their payment slots
        const cheques = window._chequeUploads || {};
        const chequeKeys = Object.keys(cheques);
        if (chequeKeys.length > 0) {
          try {
            const payments = await API.get(`/api/payments?unitId=${result.id}`);
            for (const key of chequeKeys) {
              const idx = parseInt(key);
              const payment = payments[idx];
              const cheque = cheques[idx];
              if (payment && cheque) {
                await API.put(`/api/payments/${payment.id}/cheque`, {
                  chequeFilename: cheque.filename,
                  chequeNumber: cheque.chequeNumber
                });
              }
            }
          } catch(e) { console.warn('Could not link cheques:', e.message); }
          window._chequeUploads = {};
        }

        toast('Unit added with payment schedule!', 'success');
        App.navigate('unit', { unitId: result.id, unitNumber, propertyId, propertyName: State.params.propertyName });
      }
    } catch (e) { toast(e.message, 'error'); }
  },

  async saveSettings() {
    const s = {
      anthropic_api_key: document.getElementById('s_apiKey')?.value.trim(),
      currency: document.getElementById('s_currency')?.value.trim() || 'AED',
      email_host: document.getElementById('s_emailHost')?.value.trim(),
      email_port: document.getElementById('s_emailPort')?.value.trim(),
      email_user: document.getElementById('s_emailUser')?.value.trim(),
      email_pass: document.getElementById('s_emailPass')?.value,
      email_recipient: document.getElementById('s_emailRecipient')?.value.trim(),
      google_client_id: document.getElementById('s_gClientId')?.value.trim(),
      google_api_key: document.getElementById('s_gApiKey')?.value.trim()
    };
    try {
      await API.put('/api/settings', s);
      State.settings = s;
      window._currency = s.currency || 'AED';
      toast('Settings saved!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  },

  async testEmail() {
    await Actions.saveSettings();
    try {
      await API.post('/api/settings/test-email', {});
      toast('Test email sent!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  },

  async sendReminderNow() {
    try {
      const r = await API.post('/api/settings/send-reminder-now', {});
      toast(r.sent ? `Reminder sent to ${r.to}` : 'Email not configured', r.sent ? 'success' : 'warning');
    } catch (e) { toast(e.message, 'error'); }
  },

  openGoogleDrive() {
    const s = State.settings;
    if (!s.google_client_id || !s.google_api_key) {
      toast('Add Google Drive credentials in Settings first', 'warning');
      return;
    }
    GoogleDrive.open(s.google_client_id, s.google_api_key, (file, blob) => {
      const f = new File([blob], file.name, { type: file.mimeType });
      Actions.uploadContract(f);
    });
  }
};

// ── Modals ────────────────────────────────────────────────────────────────────
const Modals = {
  collectPayment(paymentId) {
    App.openModal('Mark Payment Collected', `
      <div class="form-group">
        <label class="form-label">Payment Method *</label>
        <div class="method-grid">
          <button class="method-btn" id="method-cash" onclick="Modals._selectMethod('cash')">
            ${icon('cash')}<span>Cash</span>
          </button>
          <button class="method-btn" id="method-bank_transfer" onclick="Modals._selectMethod('bank_transfer')">
            ${icon('bank')}<span>Bank Transfer</span>
          </button>
          <button class="method-btn" id="method-cheque" onclick="Modals._selectMethod('cheque')">
            ${icon('cheque')}<span>Cheque</span>
          </button>
        </div>
      </div>

      <div id="chequeSection" style="display:none">
        <div class="form-group">
          <label class="form-label">Cheque Number (optional)</label>
          <input class="form-control" id="chequeNumber" placeholder="e.g. 001234"/>
        </div>
        <div class="form-group">
          <label class="form-label">Upload Cheque Image (optional)</label>
          <input type="file" id="chequeFileInput" accept="image/*" capture="environment"
            style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"
            onchange="Modals._previewCheque(this.files[0])">
          <label for="chequeFileInput" class="upload-zone" style="padding:16px;cursor:pointer;display:block">
            ${icon('camera')}
            <p style="margin:0">Take photo or upload cheque</p>
          </label>
          <div id="chequePreview"></div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Collection Date</label>
        <input class="form-control" type="date" id="collectedDate" value="${new Date().toISOString().slice(0,10)}"/>
      </div>

      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <textarea class="form-control" id="collectNotes" rows="2" placeholder="Any additional notes..."></textarea>
      </div>

      <button class="btn btn-success btn-full" id="confirmCollectBtn" onclick="Modals._confirmCollect('${paymentId}')">Confirm Payment</button>
    `);
    window._selectedMethod = null;
  },

  _selectMethod(m) {
    document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById(`method-${m}`)?.classList.add('selected');
    window._selectedMethod = m;
    document.getElementById('chequeSection').style.display = m === 'cheque' ? 'block' : 'none';
  },

  _previewCheque(file) {
    if (!file) return;
    const p = document.getElementById('chequePreview');
    p.innerHTML = `<div class="file-preview">${icon('file')}<div><div class="file-preview-name">${file.name}</div><div class="file-preview-size">${fmt.fileSize(file.size)}</div></div></div>`;
    window._chequeFile = file;
  },

  async _confirmCollect(paymentId) {
    const method = window._selectedMethod;
    if (!method) { toast('Select a payment method', 'warning'); return; }

    const collectedDate = document.getElementById('collectedDate')?.value;
    const chequeNumber = document.getElementById('chequeNumber')?.value.trim();
    const notes = document.getElementById('collectNotes')?.value.trim();
    const btn = document.getElementById('confirmCollectBtn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const fd = new FormData();
    fd.append('method', method);
    fd.append('collectedDate', collectedDate);
    if (chequeNumber) fd.append('chequeNumber', chequeNumber);
    if (notes) fd.append('notes', notes);
    if (window._chequeFile) fd.append('cheque', window._chequeFile);

    try {
      await fetch(`/api/payments/${paymentId}/collect`, { method: 'POST', body: fd });
      toast('Payment marked as collected!', 'success');
      App.closeModal();
      window._chequeFile = null;
      App.render();
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Confirm Payment'; }
  },

  deleteProperty(id, name) {
    App.openModal('Delete Property', `
      <div class="alert alert-danger">${icon('alert')} This will permanently delete <strong>${name}</strong> and ALL its units and payment records.</div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-ghost btn-full" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger btn-full" onclick="Actions._doDeleteProperty('${id}')">Delete</button>
      </div>
    `);
  },

  deleteUnit(unitId, unitNumber, propertyId, propertyName) {
    App.openModal('Delete Unit', `
      <div class="alert alert-danger">${icon('alert')} This will delete <strong>Unit ${unitNumber}</strong> and all its payment records.</div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-ghost btn-full" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger btn-full" onclick="Actions._doDeleteUnit('${unitId}','${propertyId}','${propertyName}')">Delete</button>
      </div>
    `);
  }
};

Actions._doDeleteProperty = async (id) => {
  try {
    await API.delete(`/api/properties/${id}`);
    App.closeModal();
    toast('Property deleted', 'success');
    App.navigate('properties');
  } catch (e) { toast(e.message, 'error'); }
};

Actions._doDeleteUnit = async (unitId, propertyId, propertyName) => {
  try {
    await API.delete(`/api/units/${unitId}`);
    App.closeModal();
    toast('Unit deleted', 'success');
    App.navigate('property', { id: propertyId, name: propertyName });
  } catch (e) { toast(e.message, 'error'); }
};

// ── Google Drive Integration ──────────────────────────────────────────────────
const GoogleDrive = {
  _loaded: false,
  _token: null,

  open(clientId, apiKey, callback) {
    GoogleDrive._callback = callback;
    GoogleDrive._apiKey = apiKey;
    GoogleDrive._clientId = clientId;

    if (!GoogleDrive._loaded) {
      const s1 = document.createElement('script');
      s1.src = 'https://apis.google.com/js/api.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://accounts.google.com/gsi/client';
        s2.onload = () => { GoogleDrive._loaded = true; GoogleDrive._authenticate(); };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    } else {
      GoogleDrive._authenticate();
    }
  },

  _authenticate() {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GoogleDrive._clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (resp) => {
        if (resp.access_token) {
          GoogleDrive._token = resp.access_token;
          GoogleDrive._showPicker();
        }
      }
    });
    client.requestAccessToken();
  },

  _showPicker() {
    gapi.load('picker', () => {
      const picker = new google.picker.PickerBuilder()
        .addView(new google.picker.DocsView().setMimeTypes('application/pdf,image/jpeg,image/png'))
        .setOAuthToken(GoogleDrive._token)
        .setDeveloperKey(GoogleDrive._apiKey)
        .setCallback(async (data) => {
          if (data.action === google.picker.Action.PICKED) {
            const file = data.docs[0];
            toast('Downloading from Drive…');
            const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
              headers: { Authorization: `Bearer ${GoogleDrive._token}` }
            });
            const blob = await resp.blob();
            GoogleDrive._callback(file, blob);
          }
        })
        .build();
      picker.setVisible(true);
    });
  }
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const token = localStorage.getItem('pt_token');
  if (!token) { App.showAuth('login'); return; }

  // Validate token with server
  try {
    const r = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) { localStorage.removeItem('pt_token'); App.showAuth('login'); return; }
    App.currentUser = await r.json();
  } catch {
    App.showAuth('login');
    return;
  }

  try {
    State.settings = await API.get('/api/settings') || {};
    window._currency = State.settings.currency || 'AED';
  } catch (e) {
    // Settings not critical for first load
  }
  App.render();
}

init();
