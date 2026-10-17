/**
 * Generates branded "application access" pages for the static public export.
 * The public marketing site is static; the Customer Portal and Admin Dashboard
 * are part of the full-stack Node application. These pages keep navigation
 * coherent and clearly direct users to the application.
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');

function page({ title, heading, body, cta }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} · Zuno Technologies</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#08080F">
<link rel="icon" type="image/svg+xml" href="assets/zuno-favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/styles.css">
</head>
<body class="glow-bg">
<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="index.html" aria-label="Zuno Technologies home">
      <img src="assets/zuno-logo.svg" alt="ZUNO logo">
      <span class="brand-text"><b>ZUNO</b><span>Ideas Into Reality</span></span>
    </a>
    <a class="btn btn-primary btn-sm nav-cta" href="index.html">Back to website</a>
  </div>
</header>
<main class="wrap" style="min-height:60vh;display:grid;place-items:center;padding:64px 20px">
  <div class="card" style="max-width:560px;text-align:center;padding:44px 32px">
    <img src="assets/zuno-logo.svg" alt="ZUNO" style="height:56px;margin:0 auto 18px;display:block">
    <h1 style="font-size:1.6rem;margin-bottom:12px">${heading}</h1>
    <p style="color:var(--muted);line-height:1.7;margin-bottom:24px">${body}</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a class="btn btn-primary" href="${cta.href}">${cta.label}</a>
      <a class="btn btn-ghost" href="index.html">Return home</a>
    </div>
  </div>
</main>
</body>
</html>`;
}

const portal = page({
  title: 'Customer Portal',
  heading: 'Customer Portal',
  body: 'The ZUNO Customer Portal lets you create an account, manage your profile, raise support requests and track their status. It runs on the secure ZUNO application server (Node.js + database) and is not part of this static website.',
  cta: { href: 'mailto:zunocustomerscare@gmail.com?subject=Customer%20Portal%20access', label: 'Contact Customer Care' }
});

const admin = page({
  title: 'Administrator',
  heading: 'Administrator Access',
  body: 'The ZUNO administration dashboard is restricted to authorised staff. It runs on the secure ZUNO application server and requires an administrator login. Unauthorised access is not permitted.',
  cta: { href: 'mailto:zunocustomerscare@gmail.com?subject=Administrator%20access', label: 'Contact Administrator' }
});

fs.writeFileSync(path.join(OUT, 'portal.html'), portal);
fs.writeFileSync(path.join(OUT, 'admin.html'), admin);
console.log('  wrote portal.html, admin.html');
