/* ZUNO public website — lightweight, dependency-free interactions */
(function () {
  'use strict';

  /* Mobile navigation */
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('mobileMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.classList.remove('open'); toggle.classList.remove('open'); });
    });
  }

  /* FAQ accordion */
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* Scroll reveal (respects reduced motion) */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* Contact form */
  var form = document.getElementById('contactForm');
  if (form) {
    var alertBox = document.getElementById('contactAlert');
    var submit = document.getElementById('contactSubmit');
    var show = function (msg, type) {
      alertBox.textContent = msg;
      alertBox.className = 'alert show alert-' + type;
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      alertBox.className = 'alert';
      var data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        subject: form.subject.value.trim(),
        message: form.message.value.trim()
      };
      var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (data.name.length < 2) return show('Please enter your name.', 'error');
      if (!emailRe.test(data.email)) return show('Please enter a valid email address.', 'error');
      if (data.message.length < 10) return show('Please write a message of at least 10 characters.', 'error');

      submit.disabled = true;
      submit.innerHTML = '<span class="spinner"></span> Sending…';
      fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) { show(res.j.message || 'Message sent.', 'success'); form.reset(); }
          else { show(res.j.error || 'Could not send your message.', 'error'); }
        })
        .catch(function () { show('Network error. Please try again.', 'error'); })
        .finally(function () { submit.disabled = false; submit.textContent = 'Send Message'; });
    });
  }

  /* Privacy-conscious first-party analytics beacon */
  try {
    fetch('/api/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pageview', page: location.pathname })
    }).catch(function () {});
  } catch (e) {}
})();
