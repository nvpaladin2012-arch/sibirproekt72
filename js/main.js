/* =========================================================
   Сибирь Проект — тёмный лендинг: интерактив
   Без форм и сбора персональных данных: CTA — телефонные ссылки
   ========================================================= */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Google Analytics 4: события статей ---------- */
  function spTrack(name, params) {
    if (typeof window.gtag === 'function') { window.gtag('event', name, params); return; }
    if (window.dataLayer) {
      var o = { event: name }, k;
      for (k in params) if (params[k] !== undefined) o[k] = params[k];
      window.dataLayer.push(o);
    }
  }
  function spOnce(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function spSet(key) {
    try { window.sessionStorage.setItem(key, '1'); } catch (e) {}
  }

  /* ---------- Прогресс прокрутки ---------- */
  var progress = document.getElementById('progressBar');
  function updateProgress() {
    if (!progress) return;
    var max = docEl.scrollHeight - window.innerHeight;
    progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  /* ---------- Шапка при прокрутке ---------- */
  var header = document.getElementById('header');
  function onHeaderScroll() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 10);
  }
  window.addEventListener('scroll', onHeaderScroll, { passive: true });
  onHeaderScroll();

  /* ---------- Мобильное меню ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        burger.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Аккордеон FAQ (только на главной) ---------- */
  var acc = document.getElementById('accordion');
  if (acc) {
    function setBody(item, open) {
      var body = item.querySelector('.acc__body');
      body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px';
    }
    Array.prototype.forEach.call(acc.querySelectorAll('.acc__item'), function (item) {
      var head = item.querySelector('.acc__head');
      setBody(item, item.classList.contains('is-open'));
      head.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');
      head.addEventListener('click', function () {
        var willOpen = !item.classList.contains('is-open');
        Array.prototype.forEach.call(acc.querySelectorAll('.acc__item'), function (other) {
          other.classList.remove('is-open');
          setBody(other, false);
          var otherHead = other.querySelector('.acc__head');
          if (otherHead) otherHead.setAttribute('aria-expanded', 'false');
        });
        if (willOpen) {
          item.classList.add('is-open');
          setBody(item, true);
          head.setAttribute('aria-expanded', 'true');
        }
      });
    });
    window.addEventListener('resize', function () {
      Array.prototype.forEach.call(acc.querySelectorAll('.acc__item.is-open'), function (item) {
        setBody(item, true);
      });
    });
  }

  /* ---------- Аккордеон услуг на мобильных ---------- */
  var solutionCards = document.querySelectorAll('.solution');
  if (solutionCards.length) {
    var mobileAccordion = window.matchMedia('(max-width:768px)');
    Array.prototype.forEach.call(solutionCards, function (card) {
      var toggle = card.querySelector('.solution__toggle');
      card.addEventListener('click', function (e) {
        if (!mobileAccordion.matches) return;
        if (e.target.closest('a')) return;
        var willOpen = !card.classList.contains('is-open');
        card.classList.toggle('is-open', willOpen);
        if (toggle) toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });
    window.addEventListener('resize', function () {
      if (mobileAccordion.matches) return;
      Array.prototype.forEach.call(solutionCards, function (card) {
        card.classList.remove('is-open');
        var toggle = card.querySelector('.solution__toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Микроконверсии GA4: PDF, телефон, чат ---------- */
  var spChatSeen = {};
  function spEvent(name, params) {
    var p = params || {};
    if (p.event_category === undefined) p.event_category = 'microconversion';
    spTrack(name, p);
  }
  function placementOf(el) {
    var s = el.closest && el.closest('section, footer, header, .stickybar, .exitpop');
    if (!s) return 'unknown';
    return s.id || (s.className && s.className.toString().split(' ')[0]) || 'unknown';
  }

  /* Скачивание PDF-чек-листа (включая ссылки из exit-popup) и tel:-ссылки */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/\.pdf(\?|$)/i.test(href)) {
      spEvent('file_download', {
        file_name: (href.split('/').pop() || 'checklist.pdf').split('?')[0],
        file_extension: 'pdf',
        link_url: href,
        event_category: 'content',
        event_label: placementOf(a)
      });
    } else if (/^tel:/i.test(href)) {
      spEvent('phone_click', {
        phone: href.replace(/^tel:/i, ''),
        event_category: 'contact',
        event_label: placementOf(a)
      });
    }
  }, true);

  /* «Скопировать номер»: статические кнопки + кнопка в липкой панели */
  function copyPhone(btn) {
    var phone = btn.getAttribute('data-phone') || '+79224770534';
    var human = phone.replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, '8 ($1) $2-$3-$4') || phone;
    var done = function () {
      var label = btn.querySelector('span');
      btn.classList.add('is-copied');
      if (label) label.textContent = 'Скопировано ✓';
      setTimeout(function () {
        btn.classList.remove('is-copied');
        if (label) label.textContent = btn.getAttribute('data-label') || 'Скопировать номер';
      }, 2200);
      spEvent('phone_copy', {
        phone: phone, value: 1, event_category: 'contact', event_label: placementOf(btn)
      });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(human).then(done, function () {
        if (window.prompt) window.prompt('Телефон:', human);
      });
    } else if (window.prompt) {
      window.prompt('Телефон:', human);
    }
  }
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('[data-phone-copy]');
    if (btn) { e.preventDefault(); copyPhone(btn); }
  });

  (function injectStickyCopy() {
    var actions = document.querySelector('.stickybar__actions');
    if (!actions || actions.querySelector('[data-phone-copy]')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stickybar__btn stickybar__btn--copy';
    btn.setAttribute('data-phone-copy', '');
    btn.setAttribute('data-phone', '+79224770534');
    btn.setAttribute('data-label', 'Скопировать 8 (922) 477-05-34');
    btn.setAttribute('aria-label', 'Скопировать номер телефона 8 (922) 477-05-34');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span><b>Скопировать</b> <small>8 (922) 477-05-34</small></span>';
    actions.appendChild(btn);
  })();

  /* Клики по анонимному чату: CTA + лаунчер виджета (один раз с места за сессию) */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('[data-chat-open], .spw-launcher');
    if (!btn) return;
    var place = placementOf(btn);
    var method = btn.hasAttribute('data-chat-open') ? 'cta' : 'launcher';
    var key = place + ':' + method;
    if (spChatSeen[key]) return;
    spChatSeen[key] = 1;
    spEvent('chat_open', { method: method, event_category: 'contact', event_label: place });
  }, true);

  /* ---------- Бегущая строка: не анимируем вне экрана ---------- */
  var ticker = document.querySelector('.ticker');
  if (ticker && typeof IntersectionObserver === 'function') {
    var tickerIO = new IntersectionObserver(function (entries) {
      ticker.classList.toggle('is-paused', !entries[0].isIntersecting);
    }, { threshold: 0 });
    tickerIO.observe(ticker);
  }

  /* ---------- Важные новости: разворачивание «Подробнее» ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.newsfeatured'), function (nfCard) {
    var nfToggle = nfCard.querySelector('.newsfeatured__more');
    var nfBody = nfCard.querySelector('.newsfeatured__body');
    if (!nfToggle || !nfBody) return;
    var nfH3 = nfCard.querySelector('h3');
    var nfTitle = (nfH3 ? nfH3.textContent : '').replace(/\s+/g, ' ').trim().slice(0, 100);
    var nfSection = (nfCard.closest('#blog') ? 'blog' : 'news');
    var nfIO = null;
    // «Статья прочитана»: пользователь долистал до конца раскрытого текста
    function armRead() {
      if (nfIO || typeof IntersectionObserver !== 'function') return;
      nfIO = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting || !nfCard.classList.contains('is-open')) continue;
          if (nfIO) { nfIO.disconnect(); nfIO = null; }
          if (nfCard.id && spOnce('sp-read-' + nfCard.id) !== '1') {
            if (nfCard.id) spSet('sp-read-' + nfCard.id);
            spTrack('article_read', { article_id: nfCard.id, article_title: nfTitle, section: nfSection });
          }
          break;
        }
      }, { rootMargin: '60px 0px' });
      var lastEl = nfBody.lastElementChild;
      if (lastEl) nfIO.observe(lastEl);
    }
    // старт — свёрнуто
    nfCard.classList.remove('is-open');
    nfBody.style.maxHeight = '0px';
    nfToggle.addEventListener('click', function () {
      var willOpen = !nfCard.classList.contains('is-open');
      if (willOpen) {
        nfCard.classList.add('is-open');
        nfBody.style.maxHeight = (nfBody.scrollHeight + 120) + 'px';
        nfToggle.childNodes[0].nodeValue = 'Свернуть\u00a0';
        // «Статья открыта»: один раз за сессию на статью
        if (nfCard.id && spOnce('sp-open-' + nfCard.id) !== '1') {
          spSet('sp-open-' + nfCard.id);
          spTrack('article_open', { article_id: nfCard.id, article_title: nfTitle, section: nfSection });
        }
        armRead();
      } else {
        nfCard.classList.remove('is-open');
        nfBody.style.maxHeight = '0px';
        nfToggle.childNodes[0].nodeValue = 'Подробнее\u00a0';
        if (nfIO) { nfIO.disconnect(); nfIO = null; }
      }
      nfToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    window.addEventListener('resize', function () {
      if (nfCard.classList.contains('is-open')) {
        nfBody.style.maxHeight = nfBody.scrollHeight + 'px';
      }
    });
  });

  /* ---------- Отдельные страницы статей: open / read ---------- */
  var artPage = document.querySelector('.article-page');
  if (artPage) {
    var artBody = artPage.querySelector('.article-page__body');
    var artTitleEl = artPage.querySelector('.article-page__title');
    var artId = window.location.pathname;
    var artTitle = artTitleEl ? artTitleEl.textContent.replace(/\s+/g, ' ').trim() : document.title;
    var artSection = artId.indexOf('/news/') === 0 ? 'news' : 'articles';

    if (spOnce('sp-open-page-' + artId) !== '1') {
      spSet('sp-open-page-' + artId);
      spTrack('article_open', { article_id: artId, article_title: artTitle, section: artSection });
    }

    if (artBody) {
      var artRead = false;
      var checkArtRead = function () {
        if (artRead) return;
        var rect = artBody.getBoundingClientRect();
        var bottom = rect.bottom + window.scrollY;
        if (window.scrollY + window.innerHeight >= bottom - 40) {
          artRead = true;
          if (spOnce('sp-read-page-' + artId) !== '1') {
            spSet('sp-read-page-' + artId);
            spTrack('article_read', { article_id: artId, article_title: artTitle, section: artSection });
          }
          window.removeEventListener('scroll', checkArtRead);
          window.removeEventListener('resize', checkArtRead);
        }
      };
      window.addEventListener('scroll', checkArtRead, { passive: true });
      window.addEventListener('resize', checkArtRead);
      checkArtRead();
    }
  }

  /* ---------- Плавное появление блоков ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.reveal[data-delay]'), function (el) {
    el.style.setProperty('--d', (parseInt(el.getAttribute('data-delay'), 10) || 0) * 130 + 'ms');
  });

  var pending = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  function sweep() {
    var limit = window.innerHeight - 60;
    var shown = 0;

    pending = pending.filter(function (el) {
      if (el.getBoundingClientRect().top < limit) {
        var extra = Math.min(shown, 3) * 70;
        shown++;
        var d = parseInt(el.getAttribute('data-delay'), 10) * 130 + extra || extra;
        el.style.setProperty('--d', d + 'ms');
        setTimeout(function () { el.classList.add('is-visible'); }, 20);
        return false;
      }
      return true;
    });
  }
  function onSweepScroll() {
    if (pending.length) sweep();
  }
  window.addEventListener('scroll', onSweepScroll, { passive: true });
  window.addEventListener('resize', onSweepScroll);
  window.addEventListener('load', sweep);
  sweep();

  /* ---------- Наклон карточек (мышь, десктоп) ---------- */
  if (!reduced && window.matchMedia('(pointer:fine)').matches) {
    Array.prototype.forEach.call(document.querySelectorAll('.tilt'), function (card) {
      var raf = null;
      card.addEventListener('mousemove', function (e) {
        if (!card.classList.contains('is-visible') && card.classList.contains('reveal')) return;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = 'perspective(900px) rotateY(' + (px * 6).toFixed(2) + 'deg) rotateX(' + (-py * 6).toFixed(2) + 'deg) translateY(-4px)';
        });
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ---------- Пыль на канве (живой фон) ---------- */
  var canvas = document.getElementById('dust');
  var lowPower = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  if (canvas && !reduced && !lowPower) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, parts = [], rafId = null;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      var count = Math.min(45, Math.round(W / 30));
      parts = [];
      for (var i = 0; i < count; i++) {
        parts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.7 + 0.4,
          vx: (Math.random() - 0.5) * 0.22,
          vy: -(Math.random() * 0.35 + 0.08),
          hue: Math.random() < 0.62 ? '240,180,41' : '76,141,255',
          a: Math.random() * 0.5 + 0.15,
          ph: Math.random() * Math.PI * 2
        });
      }
    }

    function frame(t) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        var tw = 0.65 + 0.35 * Math.sin(t / 900 + p.ph);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + p.hue + ',' + (p.a * tw).toFixed(3) + ')';
        ctx.fill();
      }
      rafId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!rafId) {
        rafId = requestAnimationFrame(frame);
      }
    });
  }

  /* ---------- Лёгкий параллакс героя от мыши ---------- */
  var heroContent = document.getElementById('heroContent');
  if (heroContent && !reduced && window.matchMedia('(pointer:fine)').matches) {
    var heroSection = document.getElementById('hero');
    heroSection.addEventListener('mousemove', function (e) {
      var cx = e.clientX / window.innerWidth - 0.5;
      var cy = e.clientY / window.innerHeight - 0.5;
      heroContent.style.transform = 'translate3d(' + (cx * 8).toFixed(1) + 'px,' + (cy * 6).toFixed(1) + 'px,0)';
    });
    heroSection.addEventListener('mouseleave', function () {
      heroContent.style.transform = '';
    });
  }

  /* ---------- Активный пункт меню ---------- */
  var sections = document.querySelectorAll('main section[id]');
  window.addEventListener('scroll', function () {
    var pos = window.scrollY + 150;
    var currentId = '';
    Array.prototype.forEach.call(sections, function (sec) {
      if (sec.offsetTop <= pos) currentId = sec.id;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.nav__list a'), function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + currentId);
    });
  }, { passive: true });

  /* ---------- Липкая панель CTA ---------- */
  var stickybar = document.getElementById('stickybar');
  var hero = document.getElementById('hero');
  var mobileSticky = window.matchMedia('(max-width:768px)');
  function updateStickybar() {
    if (!stickybar) return;
    var pastHero = hero ? window.scrollY > hero.offsetHeight * 0.7 : window.scrollY > 320;
    var nearFooter = (window.innerHeight + window.scrollY) > (docEl.scrollHeight - 40);
    var show = mobileSticky.matches ? true : (pastHero && !nearFooter);
    stickybar.classList.toggle('is-visible', show);
    document.body.classList.toggle('has-stickybar', show);
  }
  window.addEventListener('scroll', updateStickybar, { passive: true });
  window.addEventListener('resize', updateStickybar);
  if (mobileSticky.addEventListener) mobileSticky.addEventListener('change', updateStickybar);
  updateStickybar();

  /* Кнопка «Анонимный чат» в нижней панели */
  var chatOpenButtons = document.querySelectorAll('[data-chat-open]');
  if (chatOpenButtons.length) {
    var chatOpenTries = 0;
    function openChatWidget() {
      if (typeof window.SibirProektLoadChatWidget === 'function') window.SibirProektLoadChatWidget();
      if (typeof window.SibirProektGigaChatWidgetOpen === 'function') {
        window.SibirProektGigaChatWidgetOpen();
        return;
      }
      var launcher = document.querySelector('.spw-launcher');
      if (launcher) { launcher.click(); return; }
      if (chatOpenTries++ < 20) window.setTimeout(openChatWidget, 250);
    }
    Array.prototype.forEach.call(chatOpenButtons, function (btn) {
      btn.addEventListener('click', openChatWidget);
    });
  }

  /* ---------- Карусель отзывов ---------- */
  var revViewport = document.getElementById('revViewport');
  if (revViewport) {
    var revSlides = Array.prototype.slice.call(revViewport.querySelectorAll('.rev'));
    var revPrev = document.getElementById('revPrev');
    var revNext = document.getElementById('revNext');
    var revDots = document.getElementById('revDots');

    function revMetrics() {
      var cardW = revSlides[0] ? revSlides[0].offsetWidth : 0;
      var step = revSlides.length > 1 ? (revSlides[1].offsetLeft - revSlides[0].offsetLeft) : cardW;
      var gap = Math.max(0, step - cardW);
      var perView = step ? Math.round((revViewport.clientWidth + gap) / step) : 1;
      perView = Math.max(1, Math.min(revSlides.length || 1, perView));
      return { step: step, perView: perView };
    }
    function revMax() { return revViewport.scrollWidth - revViewport.clientWidth; }
    function revPages() {
      var m = revMetrics();
      return Math.max(1, Math.ceil(revSlides.length / m.perView));
    }
    function revActivePage() {
      var max = revMax();
      if (max <= 1) return 0;
      if (max - revViewport.scrollLeft < 2) return revPages() - 1;
      var m = revMetrics();
      var pageW = m.perView * m.step;
      return Math.min(revPages() - 1, Math.max(0, Math.round(revViewport.scrollLeft / pageW)));
    }
    function revBuildDots() {
      if (!revDots) return;
      var total = revPages();
      if (revDots.children.length === total) return;
      revDots.innerHTML = '';
      for (var i = 0; i < total; i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'revslider__dot';
        dot.setAttribute('aria-label', 'Отзывы: страница ' + (i + 1) + ' из ' + total);
        (function (idx) {
          dot.addEventListener('click', function () { revGoTo(idx); });
        })(i);
        revDots.appendChild(dot);
      }
    }
    function revUpdate() {
      var active = revActivePage();
      if (revDots) {
        Array.prototype.forEach.call(revDots.children, function (dot, i) {
          dot.classList.toggle('is-active', i === active);
          if (i === active) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
      }
      if (revPrev) revPrev.disabled = revViewport.scrollLeft <= 1;
      if (revNext) revNext.disabled = revViewport.scrollLeft >= revMax() - 1;
    }
    function revGoTo(page) {
      var m = revMetrics();
      var left = page * m.perView * m.step;
      revViewport.scrollTo({ left: Math.min(left, revMax()), behavior: reduced ? 'auto' : 'smooth' });
      revUpdate();
    }
    if (revPrev) revPrev.addEventListener('click', function () { revGoTo(revActivePage() - 1); });
    if (revNext) revNext.addEventListener('click', function () { revGoTo(revActivePage() + 1); });
    revViewport.addEventListener('scroll', function () {
      if (revViewport._revRaf) return;
      revViewport._revRaf = requestAnimationFrame(function () {
        revViewport._revRaf = null;
        revUpdate();
      });
    }, { passive: true });
    revViewport.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); revGoTo(revActivePage() + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); revGoTo(revActivePage() - 1); }
    });
    function revReset() {
      revBuildDots();
      if (revViewport.scrollLeft > revMax()) revViewport.scrollLeft = revMax();
      revUpdate();
    }
    window.addEventListener('resize', revReset);
    window.addEventListener('load', revReset);
    if (typeof ResizeObserver === 'function') {
      var revRO = new ResizeObserver(function () {
        if (revRO._revT) return;
        revRO._revT = setTimeout(function () { revRO._revT = null; revReset(); }, 120);
      });
      revRO.observe(revViewport);
    }
    revReset();
  }

  /* ---------- Exit-intent popup: 4 сценария, сегментация и триггеры ---------- */
  (function () {
    var KEY_SHOWN = 'sp-exit-shown';
    var KEY_CALC = 'sp-exit-calc-seen';
    var KEY_INDEX = 'sp-exit-index';
    var KEY_CHOICE = 'sp-exit-choice';
    var ARM_DELAY = 18000;

    var path = window.location.pathname || '';
    var prefix = /\/(uslugi|news|articles)\//.test(path) ? '../' : '';
    var checklist = prefix + 'assets/files/Check-list-pered-tenderom-Sibir-Proekt.pdf';
    var urgentPage = /(zashchita-fas|bankovskie-garantii|rnp-kak-ne-popast|nezavisimaya-garantiya-bez-otkaza|uderzhanie-bankovskoy-garantii|kommercheskie-bankovskie-garantii)/i.test(path);

    var variants = [
      {
        title: 'Подождите! Проверьте заявку на 12 критических ошибок перед подачей',
        text: 'Скачайте бесплатный PDF-чек-лист от юристов по 44-ФЗ и 223-ФЗ. Файл откроется сразу в браузере — без регистрации, почты и звонков.',
        primary: { label: 'Скачать PDF-чек-лист бесплатно', href: checklist, target: '_blank', rel: 'noopener' },
        secondary: { label: 'Нет, спасибо, я уверен в своей заявке', action: 'close' }
      },
      {
        title: 'Сомневаетесь в расчётах или боитесь отклонения?',
        text: 'Скиньте номер закупки в наш анонимный чат. Юрист бесплатно оценит риски, проверит ТЗ или подберёт банк для гарантии. Мы не спрашиваем телефон и имя.',
        primary: { label: 'Написать в анонимный чат', action: 'chat', prefill: 'Здравствуйте! Хочу анонимно проверить закупку и оценить риски отклонения. Номер закупки: ' },
        secondary: { label: 'Закрыть, мне не нужна проверка', action: 'close' }
      },
      {
        title: 'Горят сроки по контракту или отклонили заявку?',
        text: 'Не рискуйте попаданием в РНП. Выпустим банковскую гарантию от 4 часов или подготовим жалобу в УФАС за 1 день.',
        primary: { label: 'Получить срочную консультацию', action: 'chat', prefill: 'Здравствуйте! Горят сроки по контракту / отклонили заявку. Нужна срочная консультация: ' },
        secondary: { label: 'У меня всё под контролем', action: 'close' }
      },
      {
        title: 'Нашли гарантию дешевле? Сделаем скидку!',
        text: 'Покажите расчёт конкурента в анонимном чате — согласуем с банком-партнёром более выгодный тариф без передачи ваших контактов.',
        primary: { label: 'Запросить скидку в чате', action: 'chat', prefill: 'Здравствуйте! Хочу запросить более выгодный тариф по банковской гарантии. Расчёт конкурента: ' },
        secondary: { label: 'Мне не нужно выгоднее.', action: 'close' }
      }
    ];

    function storeGet(key, session) {
      try { return (session ? window.sessionStorage : window.localStorage).getItem(key); } catch (e) { return null; }
    }
    function storeSet(key, value, session) {
      try { (session ? window.sessionStorage : window.localStorage).setItem(key, value); } catch (e) {}
    }
    function calcSeen() {
      return storeGet(KEY_CALC, true) === '1' || /#calculator/i.test(window.location.hash || '');
    }
    function checkCalc() {
      var el = document.getElementById('calculator');
      if (el && el.getBoundingClientRect().top < window.innerHeight * 0.6) storeSet(KEY_CALC, '1', true);
    }
    window.addEventListener('scroll', checkCalc, { passive: true });
    window.addEventListener('resize', checkCalc);
    checkCalc();

    function queryParam(name) {
      var m = new RegExp('[?&]' + name + '=([^&]+)').exec(window.location.search || '');
      return m ? decodeURIComponent(m[1]) : null;
    }
    var debugMode = /[?&]exitpopup=1(?:&|$)/.test(window.location.search);
    var forced = parseInt(queryParam('variant'), 10);
    forced = forced >= 1 && forced <= variants.length ? forced - 1 : null;

    if (!debugMode && storeGet(KEY_SHOWN, true) === '1') return;

    var overlay = null;
    var closeButton = null;
    var armed = false;
    var backSentinel = null;
    var chatLaunchClicked = false;
    var index = 0;

    function selectIndex() {
      if (forced !== null) return forced;
      if (calcSeen()) return 3;
      if (urgentPage) return 2;
      var allowed = [0, 1];
      var previous = parseInt(storeGet(KEY_INDEX) === null ? '-1' : storeGet(KEY_INDEX), 10);
      if (isNaN(previous) || allowed.indexOf(previous) === -1) return allowed[0];
      return allowed[(allowed.indexOf(previous) + 1) % allowed.length];
    }

    function clearBackSentinel() {
      if (!backSentinel) return;
      backSentinel = null;
      try { window.history.replaceState({ spExitHandled: 1 }, ''); } catch (e) {}
    }

    function armBack() {
      if (!window.history || !window.history.pushState) return;
      try {
        backSentinel = 'sp-exit-' + Date.now();
        window.history.pushState({ spExitBack: backSentinel }, '');
        window.addEventListener('popstate', function onPop(e) {
          if (!backSentinel || !e.state || e.state.spExitBack !== backSentinel) return;
          window.removeEventListener('popstate', onPop);
          backSentinel = null;
          openPopup();
        });
      } catch (e) { backSentinel = null; }
    }

    function openChatWithPrefill(text, attempt) {
      attempt = attempt || 0;
      if (typeof window.SibirProektLoadChatWidget === 'function') window.SibirProektLoadChatWidget();
      if (typeof window.SibirProektGigaChatWidgetPrefill === 'function') {
        window.SibirProektGigaChatWidgetPrefill(text);
        return;
      }
      var launcher = document.querySelector('.spw-launcher');
      if (launcher && !chatLaunchClicked) { chatLaunchClicked = true; launcher.click(); }
      if (attempt < 20) window.setTimeout(function () { openChatWithPrefill(text, attempt + 1); }, 250);
    }

    function remember(n, action) {
      storeSet(KEY_CHOICE, n + ':' + action);
      spTrack('exit_intent_choice', { variant: n + 1, action: action });
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        remember(index, 'escape');
        closePopup();
      }
    }

    function closePopup() {
      if (!overlay) return;
      overlay.hidden = true;
      document.body.classList.remove('exitpop-open');
      document.removeEventListener('keydown', onKeydown);
    }

    function openPopup() {
      if (overlay || (!debugMode && storeGet(KEY_SHOWN, true) === '1')) return;
      index = selectIndex();
      var item = variants[index];
      var segment = forced !== null ? 'debug' : (calcSeen() ? 'calculator' : (urgentPage ? 'urgent' : 'default'));
      clearBackSentinel();

      overlay = document.createElement('div');
      overlay.className = 'exitpop';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'exitpopTitle');
      overlay.hidden = true;
      overlay.innerHTML =
        '<div class="exitpop__backdrop" data-exit-close></div>' +
        '<div class="exitpop__card">' +
          '<button class="exitpop__close" type="button" data-exit-close aria-label="Закрыть окно">&times;</button>' +
          '<span class="exitpop__brand">Сибирь Проект</span>' +
          '<h2 class="exitpop__title" id="exitpopTitle"></h2>' +
          '<p class="exitpop__text"></p>' +
          '<div class="exitpop__actions"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.exitpop__title').textContent = item.title;
      overlay.querySelector('.exitpop__text').textContent = item.text;

      var actions = overlay.querySelector('.exitpop__actions');
      [item.primary, item.secondary].forEach(function (cfg, i) {
        var action = i === 0 ? 'primary' : 'secondary';
        var el;
        if (cfg.action === 'close' || cfg.action === 'chat') {
          el = document.createElement('button');
          el.type = 'button';
          if (cfg.action === 'chat') el.setAttribute('data-chat-open', '');
          el.addEventListener('click', function () {
            remember(index, action);
            closePopup();
            if (cfg.action === 'chat') openChatWithPrefill(cfg.prefill);
          });
        } else {
          el = document.createElement('a');
          el.href = cfg.href;
          if (cfg.target) el.target = cfg.target;
          if (cfg.rel) el.rel = cfg.rel;
          el.addEventListener('click', function () { remember(index, action); closePopup(); });
        }
        el.className = 'exitpop__btn ' + (i === 0 ? 'exitpop__btn--primary' : 'exitpop__btn--secondary');
        el.textContent = cfg.label;
        actions.appendChild(el);
      });

      overlay.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-exit-close')) { remember(index, 'close'); closePopup(); }
      });
      closeButton = overlay.querySelector('.exitpop__close');
      document.addEventListener('keydown', onKeydown);

      storeSet(KEY_SHOWN, '1', true);
      storeSet(KEY_INDEX, String(index));
      overlay.hidden = false;
      document.body.classList.add('exitpop-open');
      spTrack('exit_intent_shown', { variant: index + 1, segment: segment });
      closeButton.focus();
    }

    function arm() {
      if (armed) return;
      armed = true;
      var touchY = 0;
      var touchT = 0;
      document.addEventListener('mouseout', function (e) {
        if (!e.relatedTarget && e.clientY <= 0) openPopup();
      });
      document.addEventListener('mouseleave', function (e) {
        if (!e.relatedTarget && e.clientY <= 0) openPopup();
      });
      document.addEventListener('touchstart', function (e) {
        if (!e.touches[0]) return;
        touchY = e.touches[0].clientY;
        touchT = Date.now();
      }, { passive: true });
      document.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        if (!t) return;
        var dy = t.clientY - touchY;
        var dt = Date.now() - touchT;
        if (dy > 70 && dt > 0 && dy / dt > 0.45 && window.scrollY <= 80 && t.clientY > 90) {
          touchY = t.clientY;
          touchT = Date.now();
          openPopup();
        }
      }, { passive: true });
      armBack();
    }

    window.setTimeout(arm, ARM_DELAY);
    if (debugMode) window.setTimeout(openPopup, 400);
  })();

  /* ---------- Информер о cookie (без сбора данных) ---------- */
  var cookiebar = document.getElementById('cookiebar');
  if (cookiebar) {
    var seen = false;
    try { seen = window.localStorage.getItem('sp-cookie-note') === '1'; } catch (e) { seen = true; }
    if (!seen) cookiebar.hidden = false;
    var cookieOk = document.getElementById('cookiebarOk');
    if (cookieOk) cookieOk.addEventListener('click', function () {
      try { window.localStorage.setItem('sp-cookie-note', '1'); } catch (e) {}
      cookiebar.hidden = true;
    });
  }
})();
