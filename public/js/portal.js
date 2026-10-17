/* =====================================================================
   ZUNO Customer Portal — SPA logic
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  async function api(path, opts = {}) {
    const res = await fetch('/api/portal' + path, {
      credentials: 'same-origin',
      headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
      ...opts,
      body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body
    });
    let data = null; try { data = await res.json(); } catch (e) {}
    if (res.status === 401) { showAuth(); throw new Error('Please sign in again.'); }
    if (!res.ok) throw new Error((data && data.error) || 'Request failed.');
    return data;
  }

  function toast(msg, type = 'ok') {
    const t = document.createElement('div'); t.className = 'toast ' + (type === 'err' ? 'err' : 'ok'); t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 3800);
  }
  function alertBox(el, msg, type) { el.textContent = msg; el.className = 'alert show alert-' + type; }
  function openModal(html) { $('#modalCard').innerHTML = html; $('#modal').classList.add('show'); }
  function closeModal() { $('#modal').classList.remove('show'); $('#modalCard').innerHTML = ''; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  let CUSTOMER = null, COUNTS = {};

  function showAuth() { $('#appView').classList.add('hidden'); $('#authView').classList.remove('hidden'); }
  function showApp(customer, counts) {
    CUSTOMER = customer; COUNTS = counts || {};
    $('#authView').classList.add('hidden'); $('#appView').classList.remove('hidden');
    $('#custName').textContent = customer.name;
    $('#custEmail').textContent = customer.email;
    $('#avatar').textContent = (customer.name || 'Z').charAt(0).toUpperCase();
    buildNav(); navigate('dashboard');
  }

  /* auth toggles */
  $('#goRegister').onclick = (e) => { e.preventDefault(); $('#loginPane').classList.add('hidden'); $('#registerPane').classList.remove('hidden'); $('#authAlert').className = 'alert'; };
  $('#goLogin').onclick = (e) => { e.preventDefault(); $('#registerPane').classList.add('hidden'); $('#loginPane').classList.remove('hidden'); $('#authAlert').className = 'alert'; };
  $('#toggleL').onclick = () => { const p = $('#lPassword'); p.type = p.type === 'password' ? 'text' : 'password'; $('#toggleL').textContent = p.type === 'text' ? 'HIDE' : 'SHOW'; };
  $('#toggleR').onclick = () => { const p = $('#rPassword'); p.type = p.type === 'password' ? 'text' : 'password'; $('#toggleR').textContent = p.type === 'text' ? 'HIDE' : 'SHOW'; };

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('#loginBtn'); const al = $('#authAlert'); al.className = 'alert';
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in…';
    try { await api('/login', { method: 'POST', body: { email: $('#lEmail').value, password: $('#lPassword').value } }); await boot(); }
    catch (err) { alertBox(al, err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Sign In'; }
  });
  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('#regBtn'); const al = $('#authAlert'); al.className = 'alert';
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating account…';
    try { await api('/register', { method: 'POST', body: { name: $('#rName').value, email: $('#rEmail').value, phone: $('#rPhone').value, password: $('#rPassword').value } }); await boot(); }
    catch (err) { alertBox(al, err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Create Account'; }
  });
  $('#logoutBtn').onclick = async () => { try { await api('/logout', { method: 'POST' }); } catch (e) {} showAuth(); };
  $('#hamburger').onclick = () => { $('#sidebar').classList.add('open'); $('#overlay').classList.add('show'); };
  $('#overlay').onclick = () => { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); };

  /* nav */
  const ICONS = {
    dashboard: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z"/>',
    tickets: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
    notifications: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21a2 2 0 0 0 4 0"/>',
    profile: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L4 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4L19 13a7 7 0 0 0 .1-1z"/>'
  };
  const NAV = [['dashboard', 'Dashboard'], ['tickets', 'Support Requests'], ['notifications', 'Notifications'], ['profile', 'My Profile'], ['settings', 'Account Settings']];
  function buildNav() {
    $('#navScroll').innerHTML = NAV.map(([id, label]) => `<button class="nav-item" data-nav="${id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[id]}</svg>
      <span>${esc(label)}</span>${id === 'notifications' && COUNTS.unread ? `<span class="count">${COUNTS.unread}</span>` : ''}</button>`).join('');
    $('#navScroll').querySelectorAll('[data-nav]').forEach(b => b.onclick = () => navigate(b.dataset.nav));
  }
  function navigate(id) {
    $('#navScroll').querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
    $('#pageTitle').textContent = (NAV.find(n => n[0] === id) || [, 'Dashboard'])[1];
    $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show');
    const c = $('#content'); c.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    (RENDER[id] || RENDER.dashboard)(c).catch(err => { c.innerHTML = `<div class="alert alert-error show">${esc(err.message)}</div>`; });
  }

  const RENDER = {};
  RENDER.dashboard = async (c) => {
    const d = await api('/me'); CUSTOMER = d.customer; COUNTS = d.counts;
    const tickets = await api('/tickets');
    c.innerHTML = `
      <div class="panel"><h3>Welcome back, ${esc(CUSTOMER.name.split(' ')[0])} 👋</h3>
        <p class="panel-sub">Manage your account and support requests from here.</p>
        <div class="flex gap wrapf">
          <button class="btn btn-primary" id="newTicket">+ New support request</button>
          <a class="btn btn-ghost" href="/contact">Contact customer care</a>
        </div></div>
      <div class="cards mt-2">
        <div class="stat-card"><div class="label">Total requests</div><div class="value">${COUNTS.tickets || 0}</div></div>
        <div class="stat-card"><div class="label">Open requests</div><div class="value">${COUNTS.open || 0}</div></div>
        <div class="stat-card"><div class="label">Notifications</div><div class="value">${COUNTS.unread || 0}</div></div>
      </div>
      <div class="panel"><div class="panel-head"><h3>Recent support requests</h3><button class="btn btn-ghost btn-sm" id="allTickets">View all</button></div>
        ${tickets.length ? tickets.slice(0, 4).map(t => `<div class="list-row"><div class="grow"><div class="t">#${t.id} ${esc(t.subject)}</div><div class="s">${esc(t.category)} · ${esc(t.updated_at)}</div></div><span class="pill pill-${t.status}">${t.status.replace('_', ' ')}</span></div>`).join('') : '<div class="empty">You have no support requests yet.</div>'}
      </div>`;
    $('#newTicket').onclick = () => newTicketForm();
    $('#allTickets').onclick = () => navigate('tickets');
  };

  RENDER.tickets = async (c) => {
    const list = await api('/tickets');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Support Requests</h3><button class="btn btn-primary btn-sm" id="newTicket">+ New request</button></div>
      <div id="tList"></div></div>`;
    $('#newTicket').onclick = () => newTicketForm();
    $('#tList').innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Subject</th><th>Category</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>
      ${list.map(t => `<tr><td>${t.id}</td><td>${esc(t.subject)}</td><td>${esc(t.category)}</td>
        <td><span class="pill pill-${t.status}">${t.status.replace('_', ' ')}</span></td><td class="hint">${esc(t.updated_at)}</td>
        <td><button class="btn btn-ghost btn-sm" data-view="${t.id}">Open</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty"><div class="big">🎫</div>No support requests yet. Create one to get help.</div>';
    $('#tList').querySelectorAll('[data-view]').forEach(b => b.onclick = () => viewTicket(b.dataset.view));
  };

  function newTicketForm() {
    openModal(`<h3>New support request</h3>
      <div class="field"><label>Category</label><select class="select" id="tkCat">
        <option>General</option><option>Technical</option><option>Account</option><option>Billing</option><option>Product enquiry</option><option>Feedback</option></select></div>
      <div class="field"><label>Subject</label><input class="input" id="tkSub" placeholder="Brief summary"></div>
      <div class="field"><label>Description</label><textarea class="textarea" id="tkDesc" placeholder="Tell us what you need help with…"></textarea></div>
      <div class="field"><label>Attachments (optional, up to 3 · 5MB each)</label><input class="input" type="file" id="tkFiles" multiple accept="image/*,.pdf,.txt"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="tkCancel">Cancel</button><button class="btn btn-primary" id="tkSend">Submit request</button></div>`);
    $('#tkCancel').onclick = closeModal;
    $('#tkSend').onclick = async () => {
      const sub = $('#tkSub').value.trim(), desc = $('#tkDesc').value.trim();
      if (sub.length < 3) return toast('Please enter a subject', 'err');
      if (desc.length < 10) return toast('Please add more detail (10+ characters)', 'err');
      const fd = new FormData(); fd.append('category', $('#tkCat').value); fd.append('subject', sub); fd.append('description', desc);
      for (const f of $('#tkFiles').files) fd.append('attachments', f);
      try { await api('/tickets', { method: 'POST', body: fd }); closeModal(); toast('Support request submitted'); navigate('tickets'); }
      catch (e) { toast(e.message, 'err'); }
    };
  }

  async function viewTicket(id) {
    const d = await api('/tickets/' + id); const t = d.ticket;
    openModal(`<h3>#${t.id} ${esc(t.subject)}</h3>
      <p class="hint">${esc(t.category)} · <span class="pill pill-${t.status}">${t.status.replace('_', ' ')}</span></p>
      <div class="msg"><div class="meta"><span>You</span><span>${esc(t.created_at)}</span></div><div class="body">${esc(t.description)}</div></div>
      <div class="thread">${d.replies.map(r => `<div class="msg ${r.author_type === 'admin' ? 'admin' : ''}"><div class="meta"><span>${esc(r.author_name || r.author_type)}</span><span>${esc(r.created_at)}</span></div><div class="body">${esc(r.message)}</div></div>`).join('')}</div>
      ${d.attachments.length ? `<p class="hint">Your attachments: ${d.attachments.map(a => `<a href="/api/portal/attachments/${a.id}" target="_blank">${esc(a.original_name)}</a>`).join(', ')}</p>` : ''}
      ${t.status !== 'closed' ? `<div class="field"><label>Reply</label><textarea class="textarea" id="rpMsg" placeholder="Add a message…"></textarea></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="rpClose">Close</button>
        <button class="btn btn-ghost" id="rpEnd">Close request</button>
        <button class="btn btn-primary" id="rpSend">Send reply</button></div>`
      : `<div class="modal-actions"><button class="btn btn-ghost" id="rpClose">Close</button></div>`}`);
    $('#rpClose').onclick = closeModal;
    const send = $('#rpSend'); if (send) send.onclick = async () => {
      const m = $('#rpMsg').value.trim(); if (!m) return toast('Type a message', 'err');
      try { await api('/tickets/' + id + '/reply', { method: 'POST', body: { message: m } }); closeModal(); toast('Reply sent'); navigate('tickets'); }
      catch (e) { toast(e.message, 'err'); }
    };
    const end = $('#rpEnd'); if (end) end.onclick = async () => {
      try { await api('/tickets/' + id + '/close', { method: 'POST' }); closeModal(); toast('Request closed'); navigate('tickets'); }
      catch (e) { toast(e.message, 'err'); }
    };
  }

  RENDER.notifications = async (c) => {
    const list = await api('/notifications');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Notifications</h3><button class="btn btn-ghost btn-sm" id="readAll">Mark all read</button></div>
      ${list.length ? list.map(n => `<div class="list-row"><div class="grow"><div class="t">${esc(n.title || 'Notification')} ${n.is_read ? '' : '<span class="pill pill-new">New</span>'}</div><div class="s" style="white-space:normal">${esc(n.message)}</div><div class="hint">${esc(n.created_at)}</div></div></div>`).join('') : '<div class="empty">No notifications.</div>'}</div>`;
    $('#readAll').onclick = async () => { await api('/notifications/read-all', { method: 'POST' }); toast('All marked read'); navigate('notifications'); };
  };

  RENDER.profile = async (c) => {
    const d = await api('/me'); CUSTOMER = d.customer;
    c.innerHTML = `<div class="panel"><h3>My Profile</h3>
      <div class="field"><label>Full name</label><input class="input" id="pfName" value="${esc(CUSTOMER.name)}"></div>
      <div class="field"><label>Email</label><input class="input" value="${esc(CUSTOMER.email)}" disabled></div>
      <div class="field"><label>Phone</label><input class="input" id="pfPhone" value="${esc(CUSTOMER.phone || '')}"></div>
      <button class="btn btn-primary" id="pfSave">Save changes</button></div>`;
    $('#pfSave').onclick = async () => {
      try { await api('/profile', { method: 'PUT', body: { name: $('#pfName').value, phone: $('#pfPhone').value } }); toast('Profile updated'); CUSTOMER.name = $('#pfName').value; $('#custName').textContent = CUSTOMER.name; }
      catch (e) { toast(e.message, 'err'); }
    };
  };

  RENDER.settings = async (c) => {
    c.innerHTML = `<div class="panel"><h3>Change password</h3>
      <div class="panel-sub">Use at least 8 characters with letters and numbers.</div>
      <div class="field"><label>Current password</label><input class="input" type="password" id="cpCur"></div>
      <div class="field"><label>New password</label><input class="input" type="password" id="cpNew"></div>
      <button class="btn btn-primary" id="cpSave">Change password</button></div>
      <div class="panel"><h3>Account</h3>
      <div class="panel-sub">Requesting deletion marks your account for review. Our team will confirm by email.</div>
      <button class="btn btn-danger" id="delReq">Request account deletion</button></div>`;
    $('#cpSave').onclick = async () => {
      try { await api('/change-password', { method: 'POST', body: { current: $('#cpCur').value, next: $('#cpNew').value } }); toast('Password changed'); $('#cpCur').value = $('#cpNew').value = ''; }
      catch (e) { toast(e.message, 'err'); }
    };
    $('#delReq').onclick = () => {
      openModal(`<h3>Request account deletion</h3><p>This will flag your account for deletion review. Continue?</p>
        <div class="modal-actions"><button class="btn btn-ghost" id="dNo">Cancel</button><button class="btn btn-danger" id="dYes">Request deletion</button></div>`);
      $('#dNo').onclick = closeModal;
      $('#dYes').onclick = async () => {
        try { await api('/delete-request', { method: 'POST' }); closeModal(); toast('Deletion request recorded'); }
        catch (e) { toast(e.message, 'err'); }
      };
    };
  };

  /* bootstrap */
  async function boot() {
    try { const d = await api('/me'); showApp(d.customer, d.counts); }
    catch (e) { showAuth(); }
  }
  boot();
})();
