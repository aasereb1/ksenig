// ========================================
// NDA: longreads (case pages) только после верного пароля
// ========================================

const NDA_UNLOCK_KEY = 'portfolio-nda-unlock';

// ========================================
// Theme Toggle
// ========================================

const themeToggle = document.querySelector('.theme-toggle');
document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// ========================================
// Screen transitions
// ========================================

const splash = document.getElementById('splash');
const passwordScreen = document.getElementById('password-screen');
const portfolio = document.getElementById('portfolio');
const btnYandex = document.getElementById('btn-yandex');
const btnOther = document.getElementById('btn-other');
const passwordInput = document.getElementById('password-input');
const passwordSubmit = document.getElementById('password-submit');
const passwordError = document.getElementById('password-error');
const errorGoPublic = document.getElementById('error-go-public');

// On case pages — no splash, just init what's needed
if (!splash) {
  initPortfolio();
}

// Direct link to portfolio (e.g. back from case page) — NDA-режим только если был введён пароль
if (splash && new URLSearchParams(window.location.search).get('view') === 'portfolio') {
  splash.hidden = true;
  portfolio.hidden = false;
  try {
    if (localStorage.getItem(NDA_UNLOCK_KEY) === '1') {
      document.body.classList.add('yandex-mode');
    }
  } catch (e) {}
  document.getElementById('header-name').hidden = false;
  portfolio.classList.add('portfolio--entered');
  initPortfolio();
}

function showScreen(from, to, callback) {
  from.classList.add(from.classList.contains('splash') ? 'splash--leaving' : 'password-screen--leaving');
  setTimeout(() => {
    from.hidden = true;
    from.classList.remove('splash--leaving', 'password-screen--leaving');
    to.hidden = false;
    window.scrollTo(0, 0);
    if (callback) callback();
  }, 500);
}

function enterPortfolio(isYandex) {
  if (isYandex) {
    document.body.classList.add('yandex-mode');
  } else {
    document.body.classList.remove('yandex-mode');
    try {
      localStorage.removeItem(NDA_UNLOCK_KEY);
    } catch (e) {}
  }
  document.getElementById('header-name').hidden = false;
  setTimeout(() => {
    portfolio.classList.add('portfolio--entered');
    initPortfolio();
  }, 50);
}

if (splash) {

// "Я из другой компании"
btnOther.addEventListener('click', () => {
  showScreen(splash, portfolio, () => enterPortfolio(false));
});

// "Я из Яндекса"
btnYandex.addEventListener('click', () => {
  showScreen(splash, passwordScreen, () => {
    passwordInput.focus();
  });
});

// Password submit
function submitPassword() {
  const value = passwordInput.value.trim();
  if (value === "hochy_smotret'_NDA") {
    try {
      localStorage.setItem(NDA_UNLOCK_KEY, '1');
    } catch (e) {}
    showScreen(passwordScreen, portfolio, () => enterPortfolio(true));
  } else {
    passwordInput.classList.add('password-screen__input--error');
    passwordError.hidden = false;
    setTimeout(() => {
      passwordInput.classList.remove('password-screen__input--error');
    }, 400);
  }
}

passwordSubmit.addEventListener('click', submitPassword);
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitPassword();
});

// Error link "Перейди сюда" → go to public portfolio
errorGoPublic.addEventListener('click', (e) => {
  e.preventDefault();
  showScreen(passwordScreen, portfolio, () => enterPortfolio(false));
});

// Clear error on typing
passwordInput.addEventListener('input', () => {
  passwordError.hidden = true;
});

} // end if (splash)

// ========================================
// Portfolio init (called after transition)
// ========================================

function initPortfolio() {
  // Scroll Reveal
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(
    '.section__head, .card, .case-card, .section__desc, .about__photo, .about__quote, .about__text, .contact__layout'
  ).forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
  });

  // Side Nav
  document.querySelectorAll('.section[id]').forEach(s => {
    new IntersectionObserver(
      ([entry]) => {
        const link = document.querySelector(`.side-nav__link[data-section="${entry.target.id}"]`);
        if (link) link.classList.toggle('active', entry.isIntersecting);
      },
      { rootMargin: '-40% 0px -55% 0px' }
    ).observe(s);
  });

  // Case card spotlight glow
  document.querySelectorAll('.case-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
      card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
    }, { passive: true });
  });

  // Copilot robot in "Быстрый запуск" card
  const robotMount = document.getElementById('robot-mount');
  if (robotMount && typeof CopilotRobot !== 'undefined') {
    CopilotRobot.init({
      mount: robotMount,
      panel: false,
      zIndex: 1
    });
  }

  // Smooth anchor scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Copy phone to clipboard
  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  document.querySelectorAll('.contact-row--copy').forEach(btn => {
    const valueEl = btn.querySelector('.contact-row__value');
    const original = valueEl ? valueEl.textContent : '';

    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy || '';
      if (!text) return;
      try {
        await copyToClipboard(text);
        btn.classList.add('contact-row--copied');
        if (valueEl) valueEl.textContent = 'Скопировано';
        setTimeout(() => {
          btn.classList.remove('contact-row--copied');
          if (valueEl) valueEl.textContent = original;
        }, 2000);
      } catch {
        if (valueEl) valueEl.textContent = 'Не удалось скопировать';
        setTimeout(() => {
          if (valueEl) valueEl.textContent = original;
        }, 2000);
      }
    });
  });
}

// ========================================
// Custom Cursor
// ========================================

const cursor = document.querySelector('.cursor');

if (cursor && window.matchMedia('(pointer: fine)').matches) {
  let cx = 0, cy = 0, tx = 0, ty = 0;
  document.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });

  (function loop() {
    cx += (tx - cx) * 0.15;
    cy += (ty - cy) * 0.15;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  })();

  // Re-bind hover on mutations (screens appear/disappear)
  const updateHovers = () => {
    document.querySelectorAll('a, button, .card:not(.card--static), .case-card, .splash__btn').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('cursor--hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('cursor--hover'));
    });
  };
  updateHovers();
  new MutationObserver(updateHovers).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
}
