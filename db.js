/**
 * ZUNO TECHNOLOGIES — Database layer.
 *
 * Automatically selects the driver:
 *   • DATABASE_URL set  -> PostgreSQL (Neon / Supabase / Render) via db-pg.js
 *   • otherwise         -> local SQLite via db-sqlite.js (node:sqlite)
 *
 * Both drivers expose the same synchronous API, so the rest of the app is
 * completely unaware of which database is in use.
 */
const bcrypt = require('bcryptjs');

const usePostgres = !!process.env.DATABASE_URL;
const driver = usePostgres ? require('./db-pg') : require('./db-sqlite');
const { db } = driver;
const DB_PATH = usePostgres ? 'postgres (DATABASE_URL)' : driver.DB_PATH;

/* ------------------------------------------------------------------ */
/* SCHEMA + MIGRATIONS                                                 */
/* ------------------------------------------------------------------ */
driver.initSchema();

driver.addColumn('content_blocks', 'draft_title', 'TEXT');
driver.addColumn('content_blocks', 'draft_body', 'TEXT');
driver.addColumn('content_blocks', 'draft_updated_at', 'TEXT');

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */
function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`)
    .run(key, value == null ? null : String(value));
}
function logAudit(actor, action, details, ip) {
  try {
    db.prepare(`INSERT INTO audit_logs (actor_type, actor_id, actor_email, action, details, ip)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run(actor?.type || 'system', actor?.id || null, actor?.email || null, action, details || '', ip || null);
  } catch (e) { /* never break the request because of logging */ }
}
function trackEvent(event_type, page, ref) {
  try {
    db.prepare('INSERT INTO analytics_events (event_type, page, ref) VALUES (?, ?, ?)')
      .run(event_type, page || null, ref || null);
  } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* SEED                                                                */
/* ------------------------------------------------------------------ */
function seed() {
  // ---- Admin account (from env, never hardcoded in frontend) ----
  const adminEmail = (process.env.ADMIN_EMAIL || 'ebulejames9@gmail.com').toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || 'JuiceWrld999.@52';
  const existingAdmin = db.prepare('SELECT id FROM admins WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPass, 12);
    db.prepare('INSERT INTO admins (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
      .run(adminEmail, hash, 'Zuno Owner', 'owner');
    console.log('[seed] Administrator account created:', adminEmail);
  }

  // ---- Settings ----
  const defaults = {
    site_title: 'Zuno Technologies | Ideas Into Reality',
    meta_description: 'Zuno Technologies is an emerging technology company focused on innovative applications, social communication, digital entertainment, and user-centred digital experiences.',
    brand_name: 'ZUNO',
    brand_full: 'Zuno Technologies',
    slogan: 'Ideas Into Reality.',
    care_email: 'zunocustomerscare@gmail.com',
    care_phone: '',
    care_whatsapp: '',
    support_hours: 'Monday \u2013 Friday, 9:00 AM \u2013 6:00 PM (WAT)',
    care_message: 'Our customer care team is here to help. Reach out to us any time and we will respond as soon as possible.',
    contact_form_enabled: '1',
    hero_heading: 'BUILDING TOMORROW. TODAY.',
    hero_text: 'Zuno Technologies transforms ideas into digital experiences through innovative applications, modern technology, and solutions designed to connect people, empower creativity, and solve real-world problems.',
    hero_btn1: 'EXPLORE OUR PRODUCTS',
    hero_btn2: 'CONTACT CUSTOMER CARE',
    accent_primary: '#8B5CF6',
    accent_secondary: '#22D3EE',
    logo_url: '/assets/zuno-logo.svg',
    favicon_url: '/assets/zuno-favicon.svg',
    footer_text: 'Zuno Technologies \u2014 Ideas Into Reality. Building innovative digital experiences for everyone.',
    nav_home: 'Home',
    nav_about: 'About Us',
    nav_mission: 'Our Mission',
    nav_vision: 'Our Vision',
    nav_products: 'Products',
    nav_faq: 'FAQ',
    nav_contact: 'Contact Us',
    nav_portal: 'Customer Portal',
    og_image: '/assets/zuno-og.svg',
    robots: 'index, follow',
    analytics_enabled: '1'
  };
  for (const [k, v] of Object.entries(defaults)) {
    const row = db.prepare('SELECT key FROM settings WHERE key = ?').get(k);
    if (!row) setSetting(k, v);
  }

  // ---- Content blocks ----
  const blocks = [
    ['about', 'About Zuno Technologies',
      'Zuno Technologies is an emerging technology company driven by innovation, creativity, and a passion for building meaningful digital experiences.\n\nWe focus on transforming ideas into digital products through the design and development of applications that aim to make everyday experiences better. Our interests span social networking, communication platforms, mobile applications, digital entertainment, and other technology-driven solutions.\n\nWe believe every great application begins with an idea and grows through innovation, dedication, and a commitment to excellence.\n\nOur goal is to develop technology that solves real problems, connects people, empowers creativity, and creates opportunities in an increasingly digital world.\n\nAs we continue to grow, we aim to build a diverse ecosystem of applications that are intuitive, reliable, accessible, and designed around the needs of their users.\n\nAt Zuno Technologies, we don\'t just build applications. We turn ideas into reality.'],
    ['mission', 'Our Mission',
      'Our mission is to transform ideas into powerful, innovative, and user-focused applications that solve real-world problems. We are committed to developing reliable, accessible, and forward-thinking digital solutions that simplify everyday life, connect people, and empower businesses to thrive in an increasingly digital world.'],
    ['vision', 'Our Vision',
      'Our vision is to become a globally recognised technology company known for creating exceptional applications that shape the future of digital experiences. We aspire to build a diverse ecosystem of innovative apps that connect communities, inspire creativity, and make technology more accessible to everyone, everywhere.'],
    ['values_intro', 'Our Core Values', 'The principles that guide everything we build at Zuno Technologies.'],
    ['products_intro', 'Products & Applications', 'A growing ecosystem of applications designed around the needs of their users.'],
    ['faq_intro', 'Frequently Asked Questions', 'Answers to the questions we hear most often.'],
    ['contact_intro', 'Contact Us', 'Send us a message and our customer care team will get back to you.']
  ];
  for (let i = 0; i < blocks.length; i++) {
    const [key, title, body] = blocks[i];
    const row = db.prepare('SELECT id FROM content_blocks WHERE section_key = ?').get(key);
    if (!row) db.prepare('INSERT INTO content_blocks (section_key, title, body, status, sort_order) VALUES (?,?,?,?,?)')
      .run(key, title, body, 'published', i);
  }

  // ---- Core values ----
  if (Number(db.prepare('SELECT COUNT(*) c FROM values_list').get().c) === 0) {
    const vals = [
      ['Innovation', 'We explore creative ideas and develop forward-thinking digital solutions.', 'spark'],
      ['Quality', 'We aim to create reliable, well-designed, and useful digital products.', 'gem'],
      ['User-Centred Design', 'We focus on creating experiences that are accessible, intuitive, and useful.', 'user'],
      ['Integrity', 'We value honesty, responsible technology, and respect for users.', 'shield'],
      ['Continuous Growth', 'We embrace learning, improvement, and new opportunities.', 'growth']
    ];
    vals.forEach((v, i) => db.prepare('INSERT INTO values_list (title, description, icon, sort_order) VALUES (?,?,?,?)').run(v[0], v[1], v[2], i));
  }

  // ---- Products ----
  if (Number(db.prepare('SELECT COUNT(*) c FROM products').get().c) === 0) {
    const prods = [
      ['LINKUP', 'Social Networking and Instant Messaging',
        'LINKUP is an upcoming social communication platform being developed to bring people together through messaging, social interaction, and modern digital experiences.', 'coming_soon'],
      ['Zuno Games', 'Digital Entertainment and Gaming',
        'Zuno Games represents our ambition to explore engaging digital entertainment experiences and bring innovative gaming ideas to life.', 'coming_soon'],
      ['Zuno Sports', 'Sports Technology',
        'Zuno Sports is an upcoming sports-focused digital product intended to make sports information and experiences more accessible to fans.', 'coming_soon']
    ];
    prods.forEach((p, i) => db.prepare('INSERT INTO products (name, category, description, status, sort_order) VALUES (?,?,?,?,?)').run(p[0], p[1], p[2], p[3], i));
  }

  // ---- FAQs ----
  if (Number(db.prepare('SELECT COUNT(*) c FROM faqs').get().c) === 0) {
    const faqs = [
      ['What is Zuno Technologies?', 'Zuno Technologies is an emerging technology company driven by innovation, creativity, and a passion for building meaningful digital experiences. We design and develop applications that aim to make everyday experiences better.'],
      ['What products is Zuno Technologies developing?', 'We are currently developing LINKUP (a social communication platform), Zuno Games (digital entertainment), and Zuno Sports (sports technology). All are in active development.'],
      ['Is LINKUP available yet?', 'Not yet. LINKUP is currently in development and is marked as "Coming Soon". We will announce availability through our official channels once it is genuinely ready.'],
      ['How can I contact customer care?', 'You can reach our customer care team by email at zunocustomerscare@gmail.com, or by using the Contact Us form on this website. Registered customers can also submit a support ticket through the Customer Portal.'],
      ['How can I receive updates about new products?', 'You can contact our customer care team to be added to our updates list, or keep checking the Products section of this website for the latest status of each product.'],
      ['How can I submit a support request?', 'Create a free account in the Customer Portal, then open a support ticket from your dashboard. You can track its status and reply to our team from there.']
    ];
    faqs.forEach((f, i) => db.prepare('INSERT INTO faqs (question, answer, sort_order) VALUES (?,?,?)').run(f[0], f[1], i));
  }

  console.log(`[seed] Database ready (${driver.driver}) at`, DB_PATH);
}

seed();

module.exports = { db, getSetting, setSetting, logAudit, trackEvent, DB_PATH };
