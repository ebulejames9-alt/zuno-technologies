/**
 * Server-side rendered public pages. Content is pulled live from the database,
 * so anything the administrator publishes appears on the website immediately.
 */
const { db, getSetting } = require('./db');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function nl2p(s) {
  return String(s || '').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}
function S(key, fallback = '') { return getSetting(key, fallback) || ''; }

const ICONS = {
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>',
  gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3 7 9l5 12 5-12-2-6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  growth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M7 19V9M12 19V5M17 19v-7"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c0 8 7 15 15 15l1-4-5-2-2 2c-2-1-4-3-5-5l2-2-2-5z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};

function navItems() {
  return [
    ['/', 'nav_home', 'Home'],
    ['/about', 'nav_about', 'About Us'],
    ['/mission', 'nav_mission', 'Our Mission'],
    ['/vision', 'nav_vision', 'Our Vision'],
    ['/products', 'nav_products', 'Products'],
    ['/faq', 'nav_faq', 'FAQ'],
    ['/contact', 'nav_contact', 'Contact Us']
  ];
}

function head({ title, description, active }) {
  const t = title || S('site_title', 'Zuno Technologies | Ideas Into Reality');
  const d = description || S('meta_description');
  const fav = S('favicon_url', '/assets/zuno-favicon.svg');
  const og = S('og_image', '/assets/zuno-og.svg');
  const robots = S('robots', 'index, follow');
  const jsonld = {
    "@context": "https://schema.org", "@type": "Organization",
    "name": "Zuno Technologies", "slogan": S('slogan', 'Ideas Into Reality.'),
    "email": S('care_email'), "logo": S('logo_url', '/assets/zuno-logo.svg'),
    "description": d
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t)}</title>
<meta name="description" content="${esc(d)}">
<meta name="robots" content="${esc(robots)}">
<meta name="theme-color" content="#08080F">
<link rel="icon" type="image/svg+xml" href="${esc(fav)}">
<link rel="apple-touch-icon" href="${esc(fav)}">
<link rel="canonical" href="/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zuno Technologies">
<meta property="og:title" content="${esc(t)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:image" content="${esc(og)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(t)}">
<meta name="twitter:description" content="${esc(d)}">
<meta name="twitter:image" content="${esc(og)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body class="glow-bg">
`;
}

function header(active) {
  const logo = S('logo_url', '/assets/zuno-logo.svg');
  const links = navItems().map(([href, key, fb]) => {
    const label = S(key, fb);
    const isActive = active === href ? ' class="active"' : '';
    return `<a href="${href}"${isActive}>${esc(label)}</a>`;
  }).join('');
  const mob = navItems().map(([href, key, fb]) => `<a href="${href}">${esc(S(key, fb))}</a>`).join('')
    + `<a href="/portal">${esc(S('nav_portal', 'Customer Portal'))}</a>`;
  return `
<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="/" aria-label="Zuno Technologies home">
      <img src="${esc(logo)}" alt="ZUNO logo">
      <span class="brand-text"><b>ZUNO</b><span>Ideas Into Reality</span></span>
    </a>
    <nav class="nav-links" aria-label="Primary">${links}</nav>
    <a class="btn btn-primary btn-sm nav-cta" href="/portal">${esc(S('nav_portal', 'Customer Portal'))}</a>
    <button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
  <nav class="mobile-menu" id="mobileMenu" aria-label="Mobile">${mob}</nav>
</header>`;
}

function careStrip() {
  const email = S('care_email', 'zunocustomerscare@gmail.com');
  const phone = S('care_phone');
  const wa = S('care_whatsapp');
  const hours = S('support_hours');
  const msg = S('care_message');
  const items = [`<a class="care-item" href="mailto:${esc(email)}">${ICONS.mail}<span>${esc(email)}</span></a>`];
  if (phone) items.push(`<a class="care-item" href="tel:${esc(phone.replace(/\s+/g, ''))}">${ICONS.phone}<span>${esc(phone)}</span></a>`);
  if (wa) items.push(`<a class="care-item" href="https://wa.me/${esc(wa.replace(/[^\d]/g, ''))}" target="_blank" rel="noopener">${ICONS.chat}<span>WhatsApp</span></a>`);
  if (hours) items.push(`<span class="care-item">${ICONS.clock}<span>${esc(hours)}</span></span>`);
  return `
<section class="wrap" id="customer-care" aria-label="Customer care">
  <div class="care-strip">
    <div>
      <div class="care-label">Customer Care</div>
      <div class="care-title">We're here to help</div>
      <p class="mb-0" style="font-size:.92rem">${esc(msg)}</p>
      <div class="care-items mt-2">${items.join('')}</div>
    </div>
    <div class="care-actions">
      <a class="btn btn-primary" href="mailto:${esc(email)}">Email Customer Care</a>
      <a class="btn btn-ghost" href="/contact">Contact Us</a>
    </div>
  </div>
</section>`;
}

function productCard(p) {
  const soon = p.status !== 'available';
  const media = p.image_url
    ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`
    : `<span class="ph">${esc(p.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())}</span>`;
  return `
<article class="card product-card reveal">
  <div class="product-media">${media}</div>
  <div class="product-body">
    <span class="cat">${esc(p.category || 'Application')}</span>
    <h3>${esc(p.name)}</h3>
    <p>${esc(p.description)}</p>
    <div class="product-foot">
      <span class="pill ${soon ? 'pill-soon' : 'pill-avail'}">${soon ? 'Coming Soon' : 'Available'}</span>
      ${soon ? '' : `<a class="btn btn-outline btn-sm" href="/contact">Learn More</a>`}
    </div>
  </div>
</article>`;
}

function valuesGrid() {
  const vals = db.prepare('SELECT * FROM values_list WHERE visible=1 ORDER BY sort_order, id').all();
  return vals.map(v => `
    <article class="card reveal">
      <div class="icon-badge">${ICONS[v.icon] || ICONS.spark}</div>
      <h3>${esc(v.title)}</h3>
      <p>${esc(v.description)}</p>
    </article>`).join('');
}

function faqList() {
  const faqs = db.prepare('SELECT * FROM faqs WHERE published=1 ORDER BY sort_order, id').all();
  return faqs.map(f => `
    <div class="faq-item reveal">
      <button class="faq-q" aria-expanded="false">${esc(f.question)}<span class="plus">+</span></button>
      <div class="faq-a"><div class="inner">${nl2p(f.answer)}</div></div>
    </div>`).join('');
}

function block(key) {
  const b = db.prepare("SELECT title, body FROM content_blocks WHERE section_key=? AND status='published' AND visible=1").get(key);
  return b || { title: '', body: '' };
}

function contactForm() {
  if (S('contact_form_enabled', '1') !== '1') {
    return `<div class="alert alert-info show">The contact form is temporarily unavailable. Please email us at <a href="mailto:${esc(S('care_email'))}">${esc(S('care_email'))}</a>.</div>`;
  }
  return `
  <form class="form" id="contactForm" novalidate>
    <div class="form-row">
      <div class="field"><label for="cName">Your Name</label><input class="input" id="cName" name="name" required maxlength="120" autocomplete="name"></div>
      <div class="field"><label for="cEmail">Email Address</label><input class="input" id="cEmail" name="email" type="email" required maxlength="160" autocomplete="email"></div>
    </div>
    <div class="field"><label for="cSubject">Subject</label><input class="input" id="cSubject" name="subject" maxlength="160"></div>
    <div class="field"><label for="cMessage">Message</label><textarea class="textarea" id="cMessage" name="message" required minlength="10" maxlength="5000"></textarea></div>
    <div class="alert" id="contactAlert" role="status"></div>
    <button class="btn btn-primary" type="submit" id="contactSubmit">Send Message</button>
    <p class="hint">Your message is stored securely and sent to our customer care team. We never share your details.</p>
  </form>`;
}

function footer() {
  const email = S('care_email');
  const phone = S('care_phone');
  const links = navItems().map(([href, key, fb]) => `<a href="${href}">${esc(S(key, fb))}</a>`).join('');
  return `
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="brand" href="/"><img src="${esc(S('logo_url', '/assets/zuno-logo.svg'))}" alt="ZUNO logo" style="height:32px"><span class="brand-text"><b>ZUNO</b><span>Ideas Into Reality</span></span></a>
      <p class="mt-2" style="font-size:.9rem">${esc(S('footer_text'))}</p>
    </div>
    <div>
      <h4>Company</h4>
      ${links}
    </div>
    <div>
      <h4>Customer Care</h4>
      <a href="mailto:${esc(email)}">${esc(email)}</a>
      ${phone ? `<a href="tel:${esc(phone.replace(/\s+/g, ''))}">${esc(phone)}</a>` : ''}
      <a href="/portal">Customer Portal</a>
      <a href="/contact">Contact Us</a>
    </div>
  </div>
  <div class="wrap footer-bottom">
    <span>© ${new Date().getFullYear()} Zuno Technologies. All rights reserved.</span>
    <span>Ideas Into Reality.</span>
  </div>
</footer>
<script src="/js/site.js" defer></script>
</body></html>`;
}

function careSection() {
  const email = S('care_email');
  return `
<section class="section" id="contact">
  <div class="wrap grid grid-2">
    <div>
      <span class="eyebrow">Contact Us</span>
      <h2 class="section-title">${esc(block('contact_intro').title || 'Contact Us')}</h2>
      <p class="section-sub">${esc(block('contact_intro').body || '')}</p>
      <div class="care-items mt-3">
        <a class="care-item" href="mailto:${esc(email)}">${ICONS.mail}<span>${esc(email)}</span></a>
        ${S('care_phone') ? `<a class="care-item" href="tel:${esc(S('care_phone').replace(/\s+/g,''))}">${ICONS.phone}<span>${esc(S('care_phone'))}</span></a>` : ''}
      </div>
    </div>
    <div>${contactForm()}</div>
  </div>
</section>`;
}

/* ------------------------------- PAGES ------------------------------ */
function renderHome() {
  const hero = {
    h: S('hero_heading', 'BUILDING TOMORROW. TODAY.'),
    t: S('hero_text'),
    b1: S('hero_btn1', 'EXPLORE OUR PRODUCTS'),
    b2: S('hero_btn2', 'CONTACT CUSTOMER CARE')
  };
  const about = block('about');
  const mission = block('mission');
  const vision = block('vision');
  const products = db.prepare("SELECT * FROM products WHERE status != 'archived' ORDER BY sort_order, id").all();
  const body = `
${header('/')}
<main>
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <span class="eyebrow">Zuno Technologies · Ideas Into Reality.</span>
        <h1><span class="gradient-text">${esc(hero.h)}</span></h1>
        <p class="lead">${esc(hero.t)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="/products">${esc(hero.b1)}</a>
          <a class="btn btn-ghost" href="#customer-care">${esc(hero.b2)}</a>
        </div>
        <div class="hero-badges">
          <span class="badge"><span class="dot"></span> Innovation-driven</span>
          <span class="badge"><span class="dot"></span> User-centred design</span>
          <span class="badge"><span class="dot"></span> Building for the future</span>
        </div>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="orb a"></div><div class="orb b"></div><div class="grid-lines"></div>
        <div class="code-card">
          <div><span class="c">// zuno.vision</span></div>
          <div><span class="k">const</span> idea = <span class="s">"your next big thing"</span>;</div>
          <div><span class="k">function</span> build(idea) {</div>
          <div>&nbsp;&nbsp;<span class="k">return</span> reality(idea);</div>
          <div>}</div>
        </div>
        <div class="stat-row">
          <div class="stat"><b>3+</b><span>Products in development</span></div>
          <div class="stat"><b>100%</b><span>Built around users</span></div>
        </div>
      </div>
    </div>
  </section>

  ${careStrip()}

  <section class="section" id="about">
    <div class="wrap">
      <span class="eyebrow">About Us</span>
      <h2 class="section-title">${esc(about.title || 'About Zuno Technologies')}</h2>
      <div class="section-sub">${nl2p(about.body)}</div>
    </div>
  </section>

  <section class="section section--tight" id="mission">
    <div class="wrap grid grid-2">
      <div class="feature-block reveal">
        <div class="mark">&ldquo;</div>
        <span class="eyebrow">Our Mission</span>
        <p class="quote">${esc(mission.body)}</p>
      </div>
      <div class="feature-block reveal">
        <div class="mark">&ldquo;</div>
        <span class="eyebrow">Our Vision</span>
        <p class="quote">${esc(vision.body)}</p>
      </div>
    </div>
  </section>

  <section class="section" id="values">
    <div class="wrap">
      <div class="center mb-3">
        <span class="eyebrow">What Drives Us</span>
        <h2 class="section-title">${esc(block('values_intro').title || 'Our Core Values')}</h2>
        <p class="section-sub">${esc(block('values_intro').body || '')}</p>
      </div>
      <div class="grid grid-3">${valuesGrid()}</div>
    </div>
  </section>

  <section class="section" id="products">
    <div class="wrap">
      <div class="center mb-3">
        <span class="eyebrow">Products & Applications</span>
        <h2 class="section-title">${esc(block('products_intro').title || 'Products & Applications')}</h2>
        <p class="section-sub">${esc(block('products_intro').body || '')}</p>
      </div>
      <div class="grid grid-3">${products.map(productCard).join('')}</div>
    </div>
  </section>

  <section class="section" id="faq">
    <div class="wrap">
      <div class="center mb-3">
        <span class="eyebrow">Support</span>
        <h2 class="section-title">${esc(block('faq_intro').title || 'Frequently Asked Questions')}</h2>
        <p class="section-sub">${esc(block('faq_intro').body || '')}</p>
      </div>
      <div style="max-width:820px;margin:0 auto">${faqList()}</div>
    </div>
  </section>

  ${careSection()}
</main>
${footer()}`;
  return head({ active: '/' }) + body;
}

function renderSection(section) {
  const map = {
    '/about': { key: 'about', title: 'About Us', eyebrow: 'About Us' },
    '/mission': { key: 'mission', title: 'Our Mission', eyebrow: 'Our Mission' },
    '/vision': { key: 'vision', title: 'Our Vision', eyebrow: 'Our Vision' }
  };
  if (map[section]) {
    const cfg = map[section];
    const b = block(cfg.key);
    const body = `
${header(section)}
<main>
  <section class="section">
    <div class="wrap">
      <span class="eyebrow">${esc(cfg.eyebrow)}</span>
      <h1 class="section-title">${esc(b.title || cfg.title)}</h1>
      <div class="section-sub">${nl2p(b.body)}</div>
    </div>
  </section>
  ${careStrip()}
  ${careSection()}
</main>
${footer()}`;
    return head({ title: `${cfg.title} | Zuno Technologies`, active: section }) + body;
  }

  if (section === '/products') {
    const products = db.prepare("SELECT * FROM products WHERE status != 'archived' ORDER BY sort_order, id").all();
    const body = `
${header('/products')}
<main>
  <section class="section">
    <div class="wrap">
      <span class="eyebrow">Products & Applications</span>
      <h1 class="section-title">${esc(block('products_intro').title || 'Products & Applications')}</h1>
      <p class="section-sub">${esc(block('products_intro').body || '')}</p>
      <div class="grid grid-3 mt-3">${products.map(productCard).join('')}</div>
      <p class="hint mt-3">Products marked “Coming Soon” are still in development. We never list a download link until a product is genuinely ready.</p>
    </div>
  </section>
  ${careStrip()}
</main>
${footer()}`;
    return head({ title: 'Products | Zuno Technologies', active: '/products' }) + body;
  }

  if (section === '/faq') {
    const body = `
${header('/faq')}
<main>
  <section class="section">
    <div class="wrap">
      <span class="eyebrow">Support</span>
      <h1 class="section-title">${esc(block('faq_intro').title || 'Frequently Asked Questions')}</h1>
      <p class="section-sub">${esc(block('faq_intro').body || '')}</p>
      <div style="max-width:820px;margin:24px auto 0">${faqList()}</div>
    </div>
  </section>
  ${careStrip()}
</main>
${footer()}`;
    return head({ title: 'FAQ | Zuno Technologies', active: '/faq' }) + body;
  }

  if (section === '/contact') {
    const body = `
${header('/contact')}
<main>
  ${careStrip()}
  ${careSection()}
</main>
${footer()}`;
    return head({ title: 'Contact Us | Zuno Technologies', active: '/contact' }) + body;
  }
  return null;
}

function renderNotFound() {
  return head({ title: 'Page not found | Zuno Technologies' }) + header('') + `
<main><section class="section"><div class="wrap center">
  <h1 class="section-title">404 — Page not found</h1>
  <p class="section-sub">The page you're looking for doesn't exist or has moved.</p>
  <a class="btn btn-primary mt-2" href="/">Back to home</a>
</div></section></main>` + footer();
}

module.exports = { renderHome, renderSection, renderNotFound, esc, S };
