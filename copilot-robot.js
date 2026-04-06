/**
 * CopilotRobot — встраиваемый робот (глаза следуют за курсором) + опциональный сайдбар.
 *
 * Подключение:
 *   <link rel="stylesheet" href="copilot-robot.css">
 *   <script src="copilot-robot.js"></script>
 *   <script>
 *     CopilotRobot.init({
 *       sidebarBodyHTML: '<p>Ваш контент</p>',
 *       panelTitle: 'Помощник'
 *     });
 *   </script>
 *
 * API возврата init(): { open, close, toggle, isOpen, destroy, root, setSidebarBodyHTML }
 *
 * Опции:
 *   mount          — HTMLElement, куда вставить разметку (по умолчанию document.body)
 *   zIndex         — базовый z-index (по умолчанию 1000)
 *   panel          — если false, сайдбар и фон не создаются; клик вызывает onTriggerClick
 *   panelTitle     — заголовок панели
 *   sidebarBodyHTML — HTML внутри .copilot-sidebar-body
 *   triggerTitle, triggerAriaLabel — title и aria-label кнопки
 *   closeAriaLabel — aria-label кнопки закрытия
 *   onOpen, onClose — колбэки (onOpen после открытия, onClose после закрытия)
 *   onTriggerClick — если задан и panel === false, вызывается вместо открытия панели
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    mount: null,
    zIndex: 1000,
    panel: true,
    panelTitle: 'Помощник',
    sidebarBodyHTML: '',
    triggerTitle: 'Помощник',
    triggerAriaLabel: 'Открыть помощника',
    closeAriaLabel: 'Закрыть панель',
    onOpen: null,
    onClose: null,
    onTriggerClick: null
  };

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function faceMarkup() {
    return (
      '<span class="copilot-face" aria-hidden="true">' +
      '<svg class="copilot-face-bg" width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="25" cy="25" r="25" fill="#313136"/></svg>' +
      '<svg class="copilot-face-svg" width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<g class="copilot-eye-group copilot-eye-left" transform="translate(0,0)">' +
      '<rect x="12" y="16" width="7" height="18" rx="3" fill="white"/></g>' +
      '<g class="copilot-eye-group copilot-eye-right" transform="translate(0,0)">' +
      '<rect x="30" y="16" width="7" height="18" rx="3" fill="white"/></g>' +
      '</svg></span>'
    );
  }

  function panelMarkup(title, bodyHTML, closeAria, titleId) {
    return (
      '<div class="copilot-backdrop" data-cr-backdrop hidden aria-hidden="true"></div>' +
      '<aside class="copilot-sidebar" data-cr-sidebar role="dialog" aria-modal="true" aria-labelledby="' +
      esc(titleId) +
      '" aria-hidden="true" hidden>' +
      '<div class="copilot-sidebar-header">' +
      '<h2 class="copilot-sidebar-title" id="' +
      esc(titleId) +
      '" data-cr-panel-title>' +
      esc(title) +
      '</h2>' +
      '<button type="button" class="copilot-sidebar-close" data-cr-close aria-label="' +
      esc(closeAria) +
      '">×</button></div>' +
      '<div class="copilot-sidebar-body" data-cr-body>' +
      bodyHTML +
      '</div></aside>'
    );
  }

  function init(userOptions) {
    var options = {};
    var k;
    for (k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
        options[k] = DEFAULTS[k];
      }
    }
    if (userOptions) {
      for (k in userOptions) {
        if (Object.prototype.hasOwnProperty.call(userOptions, k)) {
          options[k] = userOptions[k];
        }
      }
    }

    var mount = options.mount || document.body;
    var root = document.createElement('div');
    root.className = 'copilot-robot-root';
    root.setAttribute('data-copilot-robot', '');
    root.style.setProperty('--cr-z', String(options.zIndex));

    var titleId = 'copilot-robot-title-' + Math.random().toString(36).slice(2, 11);

    var triggerHTML =
      '<button type="button" class="copilot-trigger" data-cr-trigger ' +
      'aria-label="' +
      esc(options.triggerAriaLabel) +
      '" aria-expanded="false" title="' +
      esc(options.triggerTitle) +
      '">' +
      faceMarkup() +
      '</button>';

    if (options.panel) {
      root.innerHTML =
        triggerHTML +
        panelMarkup(options.panelTitle, options.sidebarBodyHTML || '', options.closeAriaLabel, titleId);
    } else {
      root.innerHTML = triggerHTML;
    }

    mount.appendChild(root);

    var trigger = root.querySelector('[data-cr-trigger]');
    var backdrop = root.querySelector('[data-cr-backdrop]');
    var sidebar = root.querySelector('[data-cr-sidebar]');
    var closeBtn = root.querySelector('[data-cr-close]');
    if (sidebar) {
      sidebar.id = 'copilot-robot-sidebar-' + Math.random().toString(36).slice(2, 9);
      trigger.setAttribute('aria-controls', sidebar.id);
    }
    var faceSvg = trigger.querySelector('.copilot-face-svg');
    var eyeLeft = trigger.querySelector('.copilot-eye-left');
    var eyeRight = trigger.querySelector('.copilot-eye-right');
    var eyeCenters = [[15.5, 25], [33.5, 25]];
    var maxEyeOffset = 2;

    var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var panelOpen = false;

    function updateEyes(clientX, clientY) {
      if (reduceMotion || !faceSvg || !eyeLeft || !eyeRight) return;
      if (sidebar && sidebar.classList.contains('is-open')) return;

      var r = faceSvg.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      var svgX = ((clientX - r.left) / r.width) * 50;
      var svgY = ((clientY - r.top) / r.height) * 50;

      [eyeLeft, eyeRight].forEach(function (g, i) {
        var cx = eyeCenters[i][0];
        var cy = eyeCenters[i][1];
        var dx = svgX - cx;
        var dy = svgY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var scale = Math.min(maxEyeOffset, dist) / dist;
        var tx = dx * scale;
        var ty = dy * scale;
        g.setAttribute('transform', 'translate(' + tx + ',' + ty + ')');
      });
    }

    function onMouseMove(e) {
      updateEyes(e.clientX, e.clientY);
    }

    function onTouchMove(e) {
      if (e.touches.length) {
        updateEyes(e.touches[0].clientX, e.touches[0].clientY);
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && sidebar && sidebar.classList.contains('is-open')) {
        close();
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('keydown', onKeyDown);

    function open() {
      if (!options.panel || !backdrop || !sidebar || !closeBtn) return;
      backdrop.removeAttribute('hidden');
      sidebar.removeAttribute('hidden');
      backdrop.setAttribute('aria-hidden', 'false');
      sidebar.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function () {
        backdrop.classList.add('is-open');
        sidebar.classList.add('is-open');
      });
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-controls', sidebar.id);
      closeBtn.focus();
      document.body.style.overflow = 'hidden';
      panelOpen = true;
      if (typeof options.onOpen === 'function') {
        options.onOpen();
      }
    }

    function finalizeClose() {
      if (!backdrop || !sidebar) return;
      backdrop.setAttribute('hidden', '');
      sidebar.setAttribute('hidden', '');
      backdrop.setAttribute('aria-hidden', 'true');
      sidebar.setAttribute('aria-hidden', 'true');
    }

    function close() {
      if (!options.panel || !backdrop || !sidebar) return;
      backdrop.classList.remove('is-open');
      sidebar.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      trigger.focus();

      var done = false;
      function finish() {
        if (done) return;
        done = true;
        sidebar.removeEventListener('transitionend', onTransitionEnd);
        finalizeClose();
        panelOpen = false;
        if (typeof options.onClose === 'function') {
          options.onClose();
        }
      }

      function onTransitionEnd(ev) {
        if (ev.target !== sidebar || ev.propertyName !== 'transform') return;
        finish();
      }

      sidebar.addEventListener('transitionend', onTransitionEnd);
      if (reduceMotion) {
        finish();
      } else {
        global.setTimeout(finish, 400);
      }
    }

    function toggle() {
      if (!options.panel) return;
      if (sidebar.classList.contains('is-open')) {
        close();
      } else {
        open();
      }
    }

    function onTriggerClick() {
      if (!options.panel) {
        if (typeof options.onTriggerClick === 'function') {
          options.onTriggerClick({ open: open, close: close, toggle: toggle, root: root });
        }
        return;
      }
      toggle();
    }

    trigger.addEventListener('click', onTriggerClick);

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        close();
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        close();
      });
    }

    var api = {
      root: root,
      open: open,
      close: close,
      toggle: toggle,
      isOpen: function () {
        return !!sidebar && sidebar.classList.contains('is-open');
      },
      setSidebarBodyHTML: function (html) {
        var b = root.querySelector('[data-cr-body]');
        if (b) b.innerHTML = html == null ? '' : String(html);
      },
      destroy: function () {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('keydown', onKeyDown);
        trigger.removeEventListener('click', onTriggerClick);
        if (panelOpen && options.panel) {
          document.body.style.overflow = '';
        }
        if (root.parentNode) {
          root.parentNode.removeChild(root);
        }
      }
    };

    return api;
  }

  global.CopilotRobot = { init: init };
})(typeof window !== 'undefined' ? window : this);
