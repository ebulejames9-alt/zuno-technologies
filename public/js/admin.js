/* =====================================================================
   ZUNO Admin Dashboard — SPA logic
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ------------------------------ API ------------------------------ */
  async function api(path, opts = {}) {
    const res = await fetch('/api/admin' + path, {
      credentials: 'same-origin',
      headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
      ...opts,
      body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401) { showLogin(); throw new Error('Session expired. Please sign in again.'); }
    if (!res.ok) throw new Error((data && data.error) || 'Request failed.');
    return data;
  }

  /* ----------------------------- Toast ----------------------------- */
  function toast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'err' ? 'err' : 'ok');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 3800);
  }
  function alertBox(el, msg, type) { el.textContent = msg; el.className = 'alert show alert-' + type; }

  /* ----------------------------- Modal ----------------------------- */
  function openModal(html) { $('#modalCard').innerHTML = html; $('#modal').classList.add('show'); }
  function closeModal() { $('#modal').classList.remove('show'); $('#modalCard').innerHTML = ''; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  function confirmDialog(title, text, onYes, danger) {
    openModal(`<h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="modal-actions"><button class="btn btn-ghost" id="mNo">Cancel</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="mYes">Confirm</button></div>`);
    $('#mNo').onclick = closeModal;
    $('#mYes').onclick = () => { closeModal(); onYes(); };
  }

  /* ------------------------------ Auth ----------------------------- */
  let ADMIN = null;
  function showLogin() {
    $('#appView').classList.add('hidden');
    $('#loginView').classList.remove('hidden');
  }
  function showApp(admin) {
    ADMIN = admin;
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    $('#adminName').textContent = admin.name || 'Administrator';
    $('#adminEmail').textContent = admin.email || '';
    $('#avatar').textContent = (admin.name || 'Z').charAt(0).toUpperCase();
    buildNav();
    navigate('overview');
  }

  $('#togglePw').addEventListener('click', () => {
    const p = $('#password');
    const show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    $('#togglePw').textContent = show ? 'HIDE' : 'SHOW';
  });

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn'); const al = $('#loginAlert'); al.className = 'alert';
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in…';
    try {
      const data = await api('/login', { method: 'POST', body: { email: $('#email').value, password: $('#password').value } });
      showApp(data.admin);
    } catch (err) {
      alertBox(al, err.message, 'error');
    } finally { btn.disabled = false; btn.textContent = 'Sign In'; }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/logout', { method: 'POST' }); } catch (e) {}
    showLogin();
  });
  $('#collapseBtn').addEventListener('click', () => document.body.classList.toggle('sidebar-collapsed'));
  $('#hamburger').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#overlay').classList.add('show'); });
  $('#overlay').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); });

  /* ------------------------------ Nav ------------------------------ */
  const ICONS = {
    overview: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z"/>',
    content: '<path d="M4 4h16v4H4zM4 10h16v10H4z"/>',
    about: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/>',
    mission: '<path d="M12 3v18M5 8l7-5 7 5M5 8v8l7 5 7-5V8"/>',
    products: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>',
    care: '<path d="M4 5c0 8 7 15 15 15l1-4-5-2-2 2c-2-1-4-3-5-5l2-2-2-5z"/>',
    messages: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    customers: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M17 11a3 3 0 1 0 0-6M21 20c0-2.5-2-4-4-4"/>',
    support: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
    faqs: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M12 17h.01"/>',
    media: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
    appearance: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1-1.5-1-3 0-1 .8-2 2-2h2a3 3 0 0 0 3-3c0-4-3.5-6-8-6z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
    seo: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    analytics: '<path d="M4 19h16M7 19V9M12 19V5M17 19v-7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L4 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4L19 13a7 7 0 0 0 .1-1z"/>',
    audit: '<path d="M9 4h6v3H9zM6 7h12v13H6z"/><path d="M9 12h6M9 15h4"/>'
  };
  const NAV = [
    ['overview', 'Overview'], ['content', 'Website Content'], ['about', 'About Us'],
    ['mission', 'Mission & Vision'], ['products', 'Products'], ['care', 'Customer Care'],
    ['messages', 'Contact Messages'], ['customers', 'Customer Management'], ['support', 'Customer Support'],
    ['faqs', 'FAQs'], ['media', 'Media Library'], ['appearance', 'Website Appearance'],
    ['seo', 'SEO Settings'], ['analytics', 'Analytics'], ['settings', 'Administrator Settings'],
    ['audit', 'Audit Logs']
  ];
  function buildNav() {
    $('#navScroll').innerHTML = '<div class="nav-group-label">Management</div>' +
      NAV.map(([id, label]) => `<button class="nav-item" data-nav="${id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[id] || ''}</svg>
        <span>${esc(label)}</span></button>`).join('');
    $('#navScroll').querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.nav)));
  }
  function setActive(id) {
    $('#navScroll').querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
  }
  function navigate(id) {
    setActive(id);
    $('#pageTitle').textContent = (NAV.find(n => n[0] === id) || [, 'Overview'])[1];
    $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show');
    const c = $('#content');
    c.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    const fn = RENDER[id] || RENDER.overview;
    fn(c).catch(err => { c.innerHTML = `<div class="alert alert-error show">${esc(err.message)}</div>`; });
  }

  /* --------------------------- OVERVIEW ---------------------------- */
  const RENDER = {};
  RENDER.overview = async (c) => {
    const d = await api('/overview');
    const s = d.stats;
    const card = (label, val, delta) => `<div class="stat-card"><div class="label">${label}</div><div class="value">${val}</div>${delta ? `<div class="delta">${delta}</div>` : ''}</div>`;
    c.innerHTML = `
      <div class="cards">
        ${card('Customers', s.customers, `+${s.newCustomers7} in 7 days`)}
        ${card('Contact Messages', s.messages, `${s.newMessages} unread`)}
        ${card('Support Tickets', s.tickets, `${s.openTickets} open`)}
        ${card('Products', s.products, `${s.publishedProducts} available`)}
        ${card('Page Views (7d)', s.pageviews7, '')}
        ${card('Form Submissions (7d)', s.contacts7, '')}
      </div>
      <div class="grid2">
        <div class="panel"><div class="panel-head"><h3>Recent messages</h3><button class="btn btn-ghost btn-sm" data-go="messages">View all</button></div>
          ${d.recentMessages.length ? d.recentMessages.map(m => `<div class="list-row"><div class="grow"><div class="t">${esc(m.name)} · <span class="pill pill-${m.status}">${m.status}</span></div><div class="s">${esc(m.subject || '')} — ${esc(m.email)}</div></div></div>`).join('') : '<div class="empty">No messages yet.</div>'}
        </div>
        <div class="panel"><div class="panel-head"><h3>Recent support tickets</h3><button class="btn btn-ghost btn-sm" data-go="support">View all</button></div>
          ${d.recentTickets.length ? d.recentTickets.map(t => `<div class="list-row"><div class="grow"><div class="t">#${t.id} ${esc(t.subject)}</div><div class="s">${esc(t.customer)} — <span class="pill pill-${t.status}">${t.status.replace('_', ' ')}</span></div></div></div>`).join('') : '<div class="empty">No tickets yet.</div>'}
        </div>
      </div>`;
    c.querySelectorAll('[data-go]').forEach(b => b.onclick = () => navigate(b.dataset.go));
  };

  /* ------------------------ CONTENT (CMS) -------------------------- */
  async function contentEditor(c, keys, title, sub) {
    const blocks = await api('/content');
    const list = blocks.filter(b => keys.includes(b.section_key));
    c.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>${esc(title)}</h3><div class="panel-sub">${esc(sub)}</div></div></div>
      ${list.map(b => `
        <div class="sec-row" data-key="${esc(b.section_key)}">
          <div class="grow">
            <div class="flex between items-center wrapf gap"><b>${esc(b.title || b.section_key)}</b> ${b.has_draft ? '<span class="badge-draft">Unpublished draft</span>' : ''}</div>
            <div class="k">${esc(b.section_key)}</div>
            <div class="hint">Last updated ${esc(b.updated_at || '')}</div>
          </div>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-edit>Edit</button>
            ${b.has_draft ? `<button class="btn btn-primary btn-sm" data-publish>Publish</button><button class="btn btn-ghost btn-sm" data-discard>Discard</button>` : ''}
          </div>
        </div>`).join('')}
      </div>`;
    c.querySelectorAll('.sec-row').forEach(row => {
      const key = row.dataset.key;
      const block = list.find(b => b.section_key === key);
      row.querySelector('[data-edit]').onclick = () => editBlock(key, block);
      const pb = row.querySelector('[data-publish]'); if (pb) pb.onclick = () => publishBlock(key);
      const dc = row.querySelector('[data-discard]'); if (dc) dc.onclick = () => confirmDialog('Discard draft', 'Discard the unpublished draft for this section?', async () => { await api('/content/' + key + '/discard', { method: 'POST' }); toast('Draft discarded'); navigate(CURRENT); });
    });
  }
  function editBlock(key, block) {
    const t = block.draft_title != null ? block.draft_title : block.title;
    const bd = block.draft_body != null ? block.draft_body : block.body;
    openModal(`<h3>Edit: ${esc(block.title || key)}</h3>
      <div class="field"><label>Title</label><input class="input" id="ebTitle" value="${esc(t || '')}"></div>
      <div class="field"><label>Body</label><textarea class="textarea" id="ebBody" style="min-height:220px">${esc(bd || '')}</textarea></div>
      <p class="hint">Saving stores a draft. Click <b>Publish</b> to push it to the live website.</p>
      <div class="modal-actions"><button class="btn btn-ghost" id="ebCancel">Cancel</button><button class="btn btn-primary" id="ebSave">Save draft</button></div>`);
    $('#ebCancel').onclick = closeModal;
    $('#ebSave').onclick = async () => {
      try { await api('/content/' + key + '/draft', { method: 'PUT', body: { title: $('#ebTitle').value, body: $('#ebBody').value } });
        closeModal(); toast('Draft saved'); navigate(CURRENT);
      } catch (e) { toast(e.message, 'err'); }
    };
  }
  async function publishBlock(key) {
    try { await api('/content/' + key + '/publish', { method: 'POST', body: {} }); toast('Published to the live website'); navigate(CURRENT); }
    catch (e) { toast(e.message, 'err'); }
  }
  RENDER.content = (c) => contentEditor(c, ['about', 'mission', 'vision', 'values_intro', 'products_intro', 'faq_intro', 'contact_intro'], 'Website Content', 'Edit the text shown across the public website. Save a draft, then publish when ready.');
  RENDER.about = (c) => contentEditor(c, ['about'], 'About Us', 'Edit the company description shown in the About Us section.');
  RENDER.mission = (c) => contentEditor(c, ['mission', 'vision'], 'Mission & Vision', 'Edit the company mission and vision statements.');

  /* --------------------------- PRODUCTS ---------------------------- */
  RENDER.products = async (c) => {
    const list = await api('/products');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Products & Applications</h3><button class="btn btn-primary btn-sm" id="addProd">+ Add Product</button></div>
      <div class="panel-sub">Marking a product "Available" only changes its label on the website — it never deploys a separate application.</div>
      <div class="table-wrap"><table><thead><tr><th>Order</th><th>Product</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${list.map(p => `<tr>
        <td>${p.sort_order}</td>
        <td><b>${esc(p.name)}</b><div class="hint" style="max-width:320px">${esc((p.description || '').slice(0, 90))}…</div></td>
        <td>${esc(p.category || '')}</td>
        <td><span class="pill ${p.status === 'available' ? 'pill-avail' : p.status === 'archived' ? 'pill-archived' : 'pill-soon'}">${p.status.replace('_', ' ')}</span></td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${p.id}">${p.status === 'available' ? 'Set Coming Soon' : 'Set Available'}</button>
          ${p.status === 'archived' ? `<button class="btn btn-ghost btn-sm" data-restore="${p.id}">Restore</button>` : `<button class="btn btn-ghost btn-sm" data-archive="${p.id}">Archive</button>`}
          <button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button>
        </div></td></tr>`).join('')}
      </tbody></table></div></div>`;
    $('#addProd').onclick = () => productForm(null);
    c.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => productForm(list.find(x => x.id == b.dataset.edit)));
    c.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => { const p = list.find(x => x.id == b.dataset.toggle); await api('/products/' + p.id, { method: 'PUT', body: { status: p.status === 'available' ? 'coming_soon' : 'available' } }); toast('Status updated'); navigate('products'); });
    c.querySelectorAll('[data-archive]').forEach(b => b.onclick = async () => { await api('/products/' + b.dataset.archive, { method: 'PUT', body: { status: 'archived' } }); toast('Product archived'); navigate('products'); });
    c.querySelectorAll('[data-restore]').forEach(b => b.onclick = async () => { await api('/products/' + b.dataset.restore, { method: 'PUT', body: { status: 'coming_soon' } }); toast('Product restored'); navigate('products'); });
    c.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDialog('Delete product', 'This permanently removes the product. Continue?', async () => { await api('/products/' + b.dataset.del, { method: 'DELETE' }); toast('Product deleted'); navigate('products'); }, true));
  };
  function productForm(p) {
    const editing = !!p;
    openModal(`<h3>${editing ? 'Edit' : 'Add'} product</h3>
      <div class="field"><label>Name</label><input class="input" id="pName" value="${esc(p ? p.name : '')}"></div>
      <div class="field"><label>Category</label><input class="input" id="pCat" value="${esc(p ? p.category : '')}"></div>
      <div class="field"><label>Description</label><textarea class="textarea" id="pDesc">${esc(p ? p.description : '')}</textarea></div>
      <div class="field"><label>Image URL (optional)</label><input class="input" id="pImg" value="${esc(p ? (p.image_url || '') : '')}" placeholder="/uploads/public/..."></div>
      <div class="field"><label>Status</label><select class="select" id="pStatus">
        <option value="coming_soon"${p && p.status === 'coming_soon' ? ' selected' : ''}>Coming Soon</option>
        <option value="available"${p && p.status === 'available' ? ' selected' : ''}>Available</option>
        <option value="archived"${p && p.status === 'archived' ? ' selected' : ''}>Archived</option></select></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="pCancel">Cancel</button><button class="btn btn-primary" id="pSave">Save</button></div>`);
    $('#pCancel').onclick = closeModal;
    $('#pSave').onclick = async () => {
      const body = { name: $('#pName').value, category: $('#pCat').value, description: $('#pDesc').value, image_url: $('#pImg').value, status: $('#pStatus').value };
      try {
        if (editing) await api('/products/' + p.id, { method: 'PUT', body });
        else await api('/products', { method: 'POST', body });
        closeModal(); toast('Product saved'); navigate('products');
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  /* ---------------------------- CARE ------------------------------- */
  const CARE_KEYS = ['care_email', 'care_phone', 'care_whatsapp', 'support_hours', 'care_message', 'contact_form_enabled'];
  RENDER.care = async (c) => {
    const s = await api('/settings');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Customer Care</h3></div>
      <div class="panel-sub">These details appear prominently on the homepage. Leave a field empty to hide it — we never display invented contact details.</div>
      <div class="form-row two">
        <div class="field"><label>Official customer care email</label><input class="input" id="care_email" value="${esc(s.care_email || '')}"></div>
        <div class="field"><label>Official phone number (optional)</label><input class="input" id="care_phone" value="${esc(s.care_phone || '')}" placeholder="Add when available"></div>
      </div>
      <div class="form-row two">
        <div class="field"><label>WhatsApp number (optional)</label><input class="input" id="care_whatsapp" value="${esc(s.care_whatsapp || '')}" placeholder="International format, digits only"></div>
        <div class="field"><label>Support hours</label><input class="input" id="support_hours" value="${esc(s.support_hours || '')}"></div>
      </div>
      <div class="field"><label>Customer care message</label><textarea class="textarea" id="care_message">${esc(s.care_message || '')}</textarea></div>
      <div class="field"><label>Contact form</label><select class="select" id="contact_form_enabled"><option value="1"${s.contact_form_enabled === '1' ? ' selected' : ''}>Enabled</option><option value="0"${s.contact_form_enabled !== '1' ? ' selected' : ''}>Disabled</option></select></div>
      <button class="btn btn-primary" id="careSave">Save & Publish</button></div>`;
    $('#careSave').onclick = async () => {
      const body = {}; CARE_KEYS.forEach(k => body[k] = $('#' + k).value);
      try { await api('/settings', { method: 'PUT', body }); toast('Customer care details published'); }
      catch (e) { toast(e.message, 'err'); }
    };
  };

  /* -------------------------- MESSAGES ----------------------------- */
  RENDER.messages = async (c) => {
    const list = await api('/messages');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Contact Messages</h3>
      <div class="tabs" id="mFilter">
        <span class="chip active" data-f="all">All</span><span class="chip" data-f="new">New</span>
        <span class="chip" data-f="read">Read</span><span class="chip" data-f="archived">Archived</span></div></div>
      <div id="mList"></div></div>`;
    const draw = (filter) => {
      const rows = list.filter(m => filter === 'all' || m.status === filter);
      $('#mList').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>From</th><th>Subject</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>
        ${rows.map(m => `<tr><td><b>${esc(m.name)}</b><div class="hint">${esc(m.email)}</div></td>
          <td>${esc(m.subject || '')}<div class="hint" style="max-width:360px">${esc((m.message || '').slice(0, 80))}…</div></td>
          <td><span class="pill pill-${m.status}">${m.status}</span></td><td class="hint">${esc(m.created_at)}</td>
          <td><div class="actions"><button class="btn btn-ghost btn-sm" data-open="${m.id}">Open</button><button class="btn btn-danger btn-sm" data-del="${m.id}">Delete</button></div></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">No messages in this view.</div>';
      $('#mList').querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
        const m = list.find(x => x.id == b.dataset.open);
        openModal(`<h3>${esc(m.subject || 'Message')}</h3>
          <p class="hint">From <b>${esc(m.name)}</b> &lt;${esc(m.email)}&gt; · ${esc(m.created_at)}</p>
          <div class="msg"><div class="body">${esc(m.message)}</div></div>
          <div class="modal-actions"><button class="btn btn-ghost" id="mClose">Close</button>
            <a class="btn btn-ghost" href="mailto:${esc(m.email)}?subject=Re: ${encodeURIComponent(m.subject || '')}">Reply by email</a>
            <button class="btn btn-primary" id="mMark">Mark as read</button></div>`);
        $('#mClose').onclick = closeModal;
        $('#mMark').onclick = async () => { await api('/messages/' + m.id, { method: 'PUT', body: { status: 'read' } }); closeModal(); toast('Marked as read'); navigate('messages'); };
      });
      $('#mList').querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDialog('Delete message', 'Permanently delete this message?', async () => { await api('/messages/' + b.dataset.del, { method: 'DELETE' }); toast('Deleted'); navigate('messages'); }, true));
    };
    draw('all');
    $('#mFilter').querySelectorAll('.chip').forEach(ch => ch.onclick = () => { $('#mFilter').querySelectorAll('.chip').forEach(x => x.classList.remove('active')); ch.classList.add('active'); draw(ch.dataset.f); });
  };

  /* -------------------------- CUSTOMERS ---------------------------- */
  RENDER.customers = async (c) => {
    const list = await api('/customers');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Customer Management</h3>
      <input class="input" id="custSearch" placeholder="Search name or email…" style="max-width:260px"></div>
      <div id="custList"></div></div>`;
    const draw = (q) => {
      const rows = list.filter(x => !q || (x.name + ' ' + x.email).toLowerCase().includes(q.toLowerCase()));
      $('#custList').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Tickets</th><th>Status</th><th>Joined</th><th></th></tr></thead><tbody>
        ${rows.map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.email)}</td><td>${x.tickets}</td>
          <td><span class="pill pill-${x.status === 'active' ? 'active' : 'suspended'}">${x.status.replace('_', ' ')}</span></td>
          <td class="hint">${esc(x.created_at)}</td>
          <td><div class="actions"><button class="btn btn-ghost btn-sm" data-view="${x.id}">View</button>
            <button class="btn btn-ghost btn-sm" data-susp="${x.id}">${x.status === 'active' ? 'Suspend' : 'Reactivate'}</button></div></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">No customers found.</div>';
      $('#custList').querySelectorAll('[data-view]').forEach(b => b.onclick = async () => {
        const d = await api('/customers/' + b.dataset.view);
        openModal(`<h3>${esc(d.name)}</h3><p class="hint">${esc(d.email)} · joined ${esc(d.created_at)}</p>
          <div class="field"><label>Support history</label></div>
          ${d.tickets.length ? d.tickets.map(t => `<div class="list-row"><div class="grow"><div class="t">#${t.id} ${esc(t.subject)}</div><div class="s"><span class="pill pill-${t.status}">${t.status.replace('_', ' ')}</span></div></div></div>`).join('') : '<div class="empty">No tickets.</div>'}
          <div class="modal-actions"><button class="btn btn-ghost" id="cClose">Close</button></div>`);
        $('#cClose').onclick = closeModal;
      });
      $('#custList').querySelectorAll('[data-susp]').forEach(b => b.onclick = async () => {
        const x = list.find(y => y.id == b.dataset.susp);
        await api('/customers/' + x.id + '/status', { method: 'PUT', body: { status: x.status === 'active' ? 'suspended' : 'active' } });
        toast('Customer status updated'); navigate('customers');
      });
    };
    draw('');
    $('#custSearch').oninput = (e) => draw(e.target.value);
  };

  /* --------------------------- SUPPORT ----------------------------- */
  RENDER.support = async (c) => {
    const list = await api('/tickets');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Customer Support</h3>
      <div class="tabs" id="tFilter"><span class="chip active" data-f="all">All</span>
        <span class="chip" data-f="open">Open</span><span class="chip" data-f="in_progress">In Progress</span>
        <span class="chip" data-f="awaiting_customer">Awaiting Customer</span><span class="chip" data-f="resolved">Resolved</span>
        <span class="chip" data-f="closed">Closed</span></div></div><div id="tList"></div></div>`;
    const draw = (f) => {
      const rows = list.filter(t => f === 'all' || t.status === f);
      $('#tList').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Subject</th><th>Customer</th><th>Category</th><th>Status</th><th></th></tr></thead><tbody>
        ${rows.map(t => `<tr><td>${t.id}</td><td>${esc(t.subject)}</td><td>${esc(t.customer)}<div class="hint">${esc(t.customer_email)}</div></td>
          <td>${esc(t.category)}</td><td><span class="pill pill-${t.status}">${t.status.replace('_', ' ')}</span></td>
          <td><button class="btn btn-ghost btn-sm" data-view="${t.id}">Open</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">No tickets in this view.</div>';
      $('#tList').querySelectorAll('[data-view]').forEach(b => b.onclick = () => openTicket(b.dataset.view));
    };
    draw('all');
    $('#tFilter').querySelectorAll('.chip').forEach(ch => ch.onclick = () => { $('#tFilter').querySelectorAll('.chip').forEach(x => x.classList.remove('active')); ch.classList.add('active'); draw(ch.dataset.f); });
  };
  async function openTicket(id) {
    const d = await api('/tickets/' + id);
    const t = d.ticket;
    openModal(`<h3>Ticket #${t.id}: ${esc(t.subject)}</h3>
      <p class="hint">${esc(t.customer)} &lt;${esc(t.customer_email)}&gt; · ${esc(t.category)} · <span class="pill pill-${t.status}">${t.status.replace('_', ' ')}</span></p>
      <div class="msg"><div class="meta"><span>Customer</span><span>${esc(t.created_at)}</span></div><div class="body">${esc(t.description)}</div></div>
      <div class="thread">${d.replies.map(r => `<div class="msg ${r.author_type === 'admin' ? 'admin' : ''}"><div class="meta"><span>${esc(r.author_name || r.author_type)}</span><span>${esc(r.created_at)}</span></div><div class="body">${esc(r.message)}</div></div>`).join('')}</div>
      ${d.attachments.length ? `<p class="hint">Attachments: ${d.attachments.map(a => `<a href="/api/admin/attachments/${a.id}" target="_blank">${esc(a.original_name)}</a>`).join(', ')}</p>` : ''}
      <div class="field"><label>Reply to customer</label><textarea class="textarea" id="tReply" placeholder="Type your response…"></textarea></div>
      <div class="field"><label>Set status</label><select class="select" id="tStatus">
        ${['open', 'in_progress', 'awaiting_customer', 'resolved', 'closed'].map(s => `<option value="${s}"${t.status === s ? ' selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}</select></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="tClose">Close</button><button class="btn btn-primary" id="tSend">Send reply</button></div>`);
    $('#tClose').onclick = closeModal;
    $('#tSend').onclick = async () => {
      const message = $('#tReply').value.trim();
      if (!message) return toast('Please type a reply', 'err');
      try { await api('/tickets/' + id + '/reply', { method: 'POST', body: { message, status: $('#tStatus').value } });
        closeModal(); toast('Reply sent to customer'); navigate('support');
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  /* ----------------------------- FAQS ------------------------------ */
  RENDER.faqs = async (c) => {
    const list = await api('/faqs');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Frequently Asked Questions</h3><button class="btn btn-primary btn-sm" id="addFaq">+ Add FAQ</button></div>
      <div class="table-wrap"><table><thead><tr><th>Order</th><th>Question</th><th>Published</th><th>Actions</th></tr></thead><tbody>
      ${list.map(f => `<tr><td>${f.sort_order}</td><td><b>${esc(f.question)}</b><div class="hint" style="max-width:420px">${esc((f.answer || '').slice(0, 90))}…</div></td>
        <td><span class="pill ${f.published ? 'pill-avail' : 'pill-archived'}">${f.published ? 'Published' : 'Hidden'}</span></td>
        <td><div class="actions"><button class="btn btn-ghost btn-sm" data-edit="${f.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${f.id}">${f.published ? 'Hide' : 'Publish'}</button>
          <button class="btn btn-danger btn-sm" data-del="${f.id}">Delete</button></div></td></tr>`).join('')}
      </tbody></table></div></div>`;
    $('#addFaq').onclick = () => faqForm(null);
    c.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => faqForm(list.find(x => x.id == b.dataset.edit)));
    c.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => { const f = list.find(x => x.id == b.dataset.toggle); await api('/faqs/' + f.id, { method: 'PUT', body: { published: f.published ? 0 : 1 } }); toast('FAQ updated'); navigate('faqs'); });
    c.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDialog('Delete FAQ', 'Permanently delete this question?', async () => { await api('/faqs/' + b.dataset.del, { method: 'DELETE' }); toast('Deleted'); navigate('faqs'); }, true));
  };
  function faqForm(f) {
    openModal(`<h3>${f ? 'Edit' : 'Add'} FAQ</h3>
      <div class="field"><label>Question</label><input class="input" id="fQ" value="${esc(f ? f.question : '')}"></div>
      <div class="field"><label>Answer</label><textarea class="textarea" id="fA">${esc(f ? f.answer : '')}</textarea></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="fCancel">Cancel</button><button class="btn btn-primary" id="fSave">Save</button></div>`);
    $('#fCancel').onclick = closeModal;
    $('#fSave').onclick = async () => {
      const body = { question: $('#fQ').value, answer: $('#fA').value };
      try { if (f) await api('/faqs/' + f.id, { method: 'PUT', body }); else await api('/faqs', { method: 'POST', body }); closeModal(); toast('FAQ saved'); navigate('faqs'); }
      catch (e) { toast(e.message, 'err'); }
    };
  }

  /* ---------------------------- MEDIA ------------------------------ */
  RENDER.media = async (c) => {
    const list = await api('/media');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Media Library</h3>
      <label class="btn btn-primary btn-sm" style="cursor:pointer">Upload image<input type="file" id="mUpload" accept="image/*" hidden></label></div>
      <div class="panel-sub">PNG, JPG, GIF, WEBP or SVG · max 5MB. Uploaded images can be assigned to products or the logo.</div>
      <div class="cards">${list.length ? list.map(m => `<div class="stat-card" style="padding:12px">
        <img src="/uploads/public/${esc(m.stored_name)}" alt="${esc(m.filename)}" style="width:100%;height:120px;object-fit:cover;border-radius:10px">
        <div class="hint mt-1" style="word-break:break-all">${esc(m.filename)}</div>
        <div class="flex between items-center mt-1"><span class="hint">${(m.size / 1024).toFixed(0)} KB</span>
        <button class="btn btn-danger btn-sm" data-del="${m.id}">Delete</button></div></div>`).join('') : '<div class="empty">No media uploaded yet.</div>'}</div></div>`;
    $('#mUpload').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const fd = new FormData(); fd.append('file', file);
      try { const r = await api('/media', { method: 'POST', body: fd }); toast('Image uploaded'); if (navigator.clipboard) navigator.clipboard.writeText(r.url).catch(() => {}); navigate('media'); }
      catch (err) { toast(err.message, 'err'); }
    };
    c.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDialog('Delete image', 'Remove this file permanently?', async () => { await api('/media/' + b.dataset.del, { method: 'DELETE' }); toast('Deleted'); navigate('media'); }, true));
  };

  /* -------------------------- APPEARANCE --------------------------- */
  const APPEAR_KEYS = ['logo_url', 'favicon_url', 'hero_heading', 'hero_text', 'hero_btn1', 'hero_btn2', 'accent_primary', 'accent_secondary', 'footer_text', 'nav_home', 'nav_about', 'nav_mission', 'nav_vision', 'nav_products', 'nav_faq', 'nav_contact', 'nav_portal'];
  RENDER.appearance = async (c) => {
    const s = await api('/settings');
    const f = (k, label, type = 'text') => `<div class="field"><label>${label}</label><input class="input" id="${k}" type="${type}" value="${esc(s[k] || '')}"></div>`;
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Website Appearance</h3></div>
      <div class="panel-sub">Keep the brand consistent. Colours should stay within the approved violet / cyan palette.</div>
      <div class="form-row two">${f('logo_url', 'Logo URL')}${f('favicon_url', 'Favicon URL')}</div>
      <div class="field"><label>Hero heading</label><input class="input" id="hero_heading" value="${esc(s.hero_heading || '')}"></div>
      <div class="field"><label>Hero supporting text</label><textarea class="textarea" id="hero_text">${esc(s.hero_text || '')}</textarea></div>
      <div class="form-row two">${f('hero_btn1', 'Primary button label')}${f('hero_btn2', 'Secondary button label')}</div>
      <div class="form-row two">${f('accent_primary', 'Primary accent colour', 'color')}${f('accent_secondary', 'Secondary accent colour', 'color')}</div>
      <div class="field"><label>Footer text</label><textarea class="textarea" id="footer_text">${esc(s.footer_text || '')}</textarea></div>
      <h3 class="mt-3">Navigation labels</h3>
      <div class="form-row two">${['nav_home', 'nav_about', 'nav_mission', 'nav_vision', 'nav_products', 'nav_faq', 'nav_contact', 'nav_portal'].map(k => f(k, k.replace('nav_', '').replace('_', ' '))).join('')}</div>
      <div class="flex gap wrapf mt-2"><button class="btn btn-primary" id="apSave">Save & Publish</button><a class="btn btn-ghost" href="/" target="_blank">Preview website ↗</a></div></div>`;
    $('#apSave').onclick = async () => {
      const body = {}; APPEAR_KEYS.forEach(k => body[k] = $('#' + k).value);
      try { await api('/settings', { method: 'PUT', body }); toast('Appearance published'); } catch (e) { toast(e.message, 'err'); }
    };
  };

  /* ----------------------------- SEO ------------------------------- */
  RENDER.seo = async (c) => {
    const s = await api('/settings');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>SEO & Metadata</h3></div>
      <div class="field"><label>Default page title</label><input class="input" id="site_title" value="${esc(s.site_title || '')}"></div>
      <div class="field"><label>Meta description</label><textarea class="textarea" id="meta_description">${esc(s.meta_description || '')}</textarea></div>
      <div class="field"><label>Social sharing image (OG image URL)</label><input class="input" id="og_image" value="${esc(s.og_image || '')}"></div>
      <div class="field"><label>Robots directive</label><select class="select" id="robots">
        <option value="index, follow"${s.robots === 'index, follow' ? ' selected' : ''}>index, follow</option>
        <option value="noindex, nofollow"${s.robots === 'noindex, nofollow' ? ' selected' : ''}>noindex, nofollow</option></select></div>
      <button class="btn btn-primary" id="seoSave">Save & Publish</button>
      <p class="hint mt-2">Sitemap available at <a href="/sitemap.xml" target="_blank">/sitemap.xml</a> · robots.txt at <a href="/robots.txt" target="_blank">/robots.txt</a></p></div>`;
    $('#seoSave').onclick = async () => {
      const body = { site_title: $('#site_title').value, meta_description: $('#meta_description').value, og_image: $('#og_image').value, robots: $('#robots').value };
      try { await api('/settings', { method: 'PUT', body }); toast('SEO settings published'); } catch (e) { toast(e.message, 'err'); }
    };
  };

  /* --------------------------- ANALYTICS --------------------------- */
  RENDER.analytics = async (c) => {
    const d = await api('/analytics');
    if (!d.enabled) { c.innerHTML = '<div class="panel"><div class="empty">Analytics is currently disabled. Enable it in Administrator Settings.</div></div>'; return; }
    const max = Math.max(1, ...d.series.map(x => x.c));
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Analytics</h3><span class="hint">First-party, privacy-conscious · last ${d.days} days</span></div>
      <div class="cards">
        <div class="stat-card"><div class="label">Total page views</div><div class="value">${d.totals.pageviews}</div></div>
        <div class="stat-card"><div class="label">Contact submissions</div><div class="value">${d.totals.contacts}</div></div>
        <div class="stat-card"><div class="label">Registrations</div><div class="value">${d.totals.registrations}</div></div>
        <div class="stat-card"><div class="label">Support tickets</div><div class="value">${d.totals.tickets}</div></div>
      </div>
      <div class="panel" style="margin-top:16px"><h3>Daily page views</h3>
        <div class="bar-chart">${d.series.length ? d.series.map(x => `<div class="bar" style="height:${Math.max(4, x.c / max * 140)}px" title="${x.d}: ${x.c}"><span>${esc(x.d.slice(5))}</span></div>`).join('') : '<div class="empty">No data yet.</div>'}</div>
      </div>
      <div class="panel"><h3>Popular pages</h3>
        ${d.popular.length ? d.popular.map(p => `<div class="list-row"><div class="grow"><div class="t">${esc(p.page)}</div></div><span class="pill pill-soon">${p.c} views</span></div>`).join('') : '<div class="empty">No data yet.</div>'}
      </div></div>`;
  };

  /* --------------------------- SETTINGS ---------------------------- */
  RENDER.settings = async (c) => {
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Administrator Settings</h3></div>
      <div class="field"><label>Administrator name</label><input class="input" id="adName" value="${esc(ADMIN.name || '')}"></div>
      <div class="field"><label>Email (login)</label><input class="input" value="${esc(ADMIN.email)}" disabled></div>
      <button class="btn btn-primary" id="adSave">Save profile</button></div>
      <div class="panel"><h3>Change password</h3>
      <div class="panel-sub">Passwords are hashed with bcrypt and never stored in plain text.</div>
      <div class="field"><label>Current password</label><input class="input" type="password" id="pwCur"></div>
      <div class="field"><label>New password</label><input class="input" type="password" id="pwNew"></div>
      <div class="field"><label>Confirm new password</label><input class="input" type="password" id="pwCon"></div>
      <button class="btn btn-primary" id="pwSave">Change password</button></div>
      <div class="panel"><h3>Analytics</h3>
      <div class="field"><label>First-party analytics</label><select class="select" id="analytics_enabled">
        <option value="1">Enabled</option><option value="0">Disabled</option></select></div>
      <button class="btn btn-primary" id="anSave">Save</button></div>`;
    const s = await api('/settings'); $('#analytics_enabled').value = s.analytics_enabled === '0' ? '0' : '1';
    $('#adSave').onclick = async () => { try { await api('/profile', { method: 'PUT', body: { name: $('#adName').value } }); ADMIN.name = $('#adName').value; $('#adminName').textContent = ADMIN.name; toast('Profile saved'); } catch (e) { toast(e.message, 'err'); } };
    $('#pwSave').onclick = async () => {
      const cur = $('#pwCur').value, nw = $('#pwNew').value, cn = $('#pwCon').value;
      if (nw !== cn) return toast('New passwords do not match', 'err');
      try { await api('/change-password', { method: 'POST', body: { current: cur, next: nw } }); toast('Password changed'); $('#pwCur').value = $('#pwNew').value = $('#pwCon').value = ''; }
      catch (e) { toast(e.message, 'err'); }
    };
    $('#anSave').onclick = async () => { await api('/settings', { method: 'PUT', body: { analytics_enabled: $('#analytics_enabled').value } }); toast('Saved'); };
  };

  /* ----------------------------- AUDIT ----------------------------- */
  RENDER.audit = async (c) => {
    const list = await api('/audit');
    c.innerHTML = `<div class="panel"><div class="panel-head"><h3>Audit Logs</h3><span class="hint">Most recent 200 actions</span></div>
      <div class="table-wrap"><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th><th>IP</th></tr></thead><tbody>
      ${list.map(l => `<tr><td class="hint">${esc(l.created_at)}</td><td>${esc(l.actor_email || l.actor_type || '')}</td>
        <td><b>${esc(l.action)}</b></td><td class="hint">${esc(l.details || '')}</td><td class="hint">${esc(l.ip || '')}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  };

  /* --------------------------- Bootstrap --------------------------- */
  let CURRENT = 'overview';
  const _nav = navigate;
  navigate = function (id) { CURRENT = id; _nav(id); };

  (async function init() {
    try {
      const d = await api('/me');
      showApp(d.admin);
    } catch (e) { showLogin(); }
  })();
})();
