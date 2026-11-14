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
      setBody(item, item.classList.contains('is-open'));
      item.querySelector('.acc__head').addEventListener('click', function () {
        var willOpen = !item.classList.contains('is-open');
        Array.prototype.forEach.call(acc.querySelectorAll('.acc__item'), function (other) {
          other.classList.remove('is-open');
          setBody(other, false);
        });
        if (willOpen) {
          item.classList.add('is-open');
          setBody(item, true);
        }
      });
    });
    window.addEventListener('resize', function () {
      Array.prototype.forEach.call(acc.querySelectorAll('.acc__item.is-open'), function (item) {
        setBody(item, true);
      });
    });
  }

  /* ---------- Калькулятор стоимости ---------- */
  var calcForm = document.getElementById('calcForm');
  if (calcForm) {
    var cService = document.getElementById('calcService');
    var cLaw = document.getElementById('calcLaw');
    var cGType = document.getElementById('calcGType');
    var cSum = document.getElementById('calcSum');
    var cEndDate = document.getElementById('calcEndDate');
    var cDays = document.getElementById('calcDays');
    var cDateError = document.getElementById('calcDateError');
    var cPrice = document.getElementById('calcPrice');
    var cBest = document.getElementById('calcBest');
    var cTerm = document.getElementById('calcTerm');
    var cSumView = document.getElementById('calcSumView');
    var cInc = document.getElementById('calcInc');
    var cCopy = document.getElementById('calcCopy');
    var lastCalc = null;

    var DAY_MS = 86400000;

    var fmtNum = function (n) {
      return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    };
    var rub = function (n) { return fmtNum(n) + '\u00a0₽'; };
    var num = function (el, fallback) {
      var v = parseInt(el && el.value, 10);
      return isFinite(v) && v >= 0 ? v : (fallback || 0);
    };

    function startOfToday() {
      var d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    function addDays(date, days) {
      var d = new Date(date.getTime());
      d.setDate(d.getDate() + days);
      return d;
    }
    function isoDate(d) {
      var m = d.getMonth() + 1;
      var day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
    }
    function parseDateInput(value) {
      if (!value) return null;
      var parts = value.split('-');
      if (parts.length !== 3) return null;
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    }
    function formatDateRu(d) {
      var m = d.getMonth() + 1;
      var day = d.getDate();
      return (day < 10 ? '0' + day : day) + '.' + (m < 10 ? '0' + m : m) + '.' + d.getFullYear();
    }
    function pluralDays(n) {
      var mod10 = n % 10;
      var mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return 'день';
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
      return 'дней';
    }

    var lawLabel = {
      '44fz': 'Госзакупки (44-ФЗ / 223-ФЗ)',
      comm: 'Коммерческий контракт'
    };
    var gTypeLabel = {
      execution: 'На исполнение контракта',
      tender: 'На участие (тендерная)',
      warranty: 'Гарантийные обязательства'
    };

    /* Тарифная сетка №1: доступна только для госзакупок,
       кроме гарантийных обязательств и в пределах лимитов. */
    function calcGrid1(amount, days, law, type) {
      if (law !== '44fz') return null;
      if (type === 'warranty') return null;

      var rate = 0;
      var minFee = 0;

      if (type === 'execution') {
        if (amount > 30000000 || days > 540) return null;
        rate = 2.3;
        if (amount <= 50000) {
          if (days <= 90) minFee = 1440;
          else if (days <= 180) minFee = 1800;
          else if (days <= 365) minFee = 2400;
          else minFee = 3000;
        } else if (amount <= 100000) {
          if (days <= 90) minFee = 1680;
          else if (days <= 180) minFee = 2160;
          else if (days <= 365) minFee = 2640;
          else minFee = 3600;
        } else if (amount <= 10000000) {
          minFee = 2400;
        } else {
          minFee = 30000;
        }
      } else if (type === 'tender') {
        if (amount > 5000000 || days > 150) return null;
        rate = 2.1;
        if (amount <= 50000) minFee = 1080;
        else if (amount <= 500000) minFee = 1320;
        else if (amount <= 2000000) minFee = 2400;
        else minFee = 5000;
      } else {
        return null;
      }

      var calculated = amount * (rate / 100) * (days / 365);
      return { price: Math.max(calculated, minFee) };
    }

    /* Тарифная сетка №2: доступна для всех типов закупок. */
    function calcGrid2(amount, days, law, type) {
      var rate = 0;
      var minFee = (law === '44fz') ? 2000 : 3000;

      if (law === '44fz') {
        if (type === 'execution') rate = 2.3;
        else if (type === 'tender') rate = 2.1;
        else if (type === 'warranty') rate = (days <= 1155) ? 2.31 : 5.25;
      } else {
        if (type === 'execution' || type === 'tender') rate = 3.5;
        else if (type === 'warranty') rate = (days <= 1155) ? 3.5 : 5.25;
      }

      var calculated = amount * (rate / 100) * (days / 365);
      return { price: Math.max(calculated, minFee) };
    }

    function bestPrice(amount, days, law, type) {
      var grid1 = calcGrid1(amount, days, law, type);
      var grid2 = calcGrid2(amount, days, law, type);
      var best = grid2.price;
      if (grid1 !== null && grid1.price < best) best = grid1.price;
      return best;
    }

    function calcIncludes() {
      return [
        'Подбор банка-партнёра под вашу задачу',
        'Проверка документов и расчёт тарифа',
        'Согласование проекта гарантии с заказчиком',
        'Выпуск гарантии в электронном виде'
      ];
    }

    function recalc() {
      var service = cService.value;
      var law = cLaw.value;
      var type = cGType.value;
      var s = num(cSum, 0);
      var end = parseDateInput(cEndDate.value);
      var today = startOfToday();
      var days = end ? Math.round((end.getTime() - today.getTime()) / DAY_MS) : 0;
      var dateInvalid = !!end && days <= 0;
      var dateOk = !!end && !dateInvalid;
      var valid = dateOk && s >= 1000;
      var price = valid ? bestPrice(s, days, law, type) : 0;
      var includes = calcIncludes();

      if (cDateError) cDateError.hidden = !dateInvalid;
      if (cEndDate) {
        cEndDate.classList.toggle('is-invalid', dateInvalid);
        cEndDate.setAttribute('aria-invalid', dateInvalid ? 'true' : 'false');
      }

      cPrice.textContent = valid ? rub(price) : '—';
      cBest.hidden = !valid;
      cTerm.textContent = dateOk ? '1 рабочий день · ' + days + ' ' + pluralDays(days) : '—';
      cSumView.textContent = s ? rub(s) : '—';
      cDays.textContent = dateOk ? days + ' ' + pluralDays(days) : '—';

      var html = '';
      for (var i = 0; i < includes.length; i++) {
        html += '<li>' + includes[i] + '</li>';
      }
      cInc.innerHTML = html;

      lastCalc = {
        service: service,
        sum: s,
        days: days,
        end: end,
        law: law,
        type: type,
        price: price,
        mailBody: ''
      };

      if (valid) {
        var lines = ['Здравствуйте! Прошу уточнить стоимость и условия.', '', 'Услуга: Независимые (банковские) гарантии'];
        lines.push('Тип закупки: ' + lawLabel[law]);
        lines.push('Вид гарантии: ' + gTypeLabel[type]);
        lines.push('Сумма гарантии: ' + rub(s));
        lines.push('Дата окончания гарантии: ' + formatDateRu(end) + ' (' + days + ' ' + pluralDays(days) + ')');
        lines.push('Предварительный расчёт: ' + rub(price));
        lines.push('Срок выпуска: 1 рабочий день');
        lines.push('', 'Расчёт с сайта sibirproekt72.ru');
        lastCalc.mailBody = lines.join('\n');
      }

      if (cCopy) cCopy.disabled = !valid;
    }

    // min — завтрашняя дата, по умолчанию — через год
    var today = startOfToday();
    if (cEndDate) {
      cEndDate.min = isoDate(addDays(today, 1));
      cEndDate.value = isoDate(addDays(today, 365));
    }

    cService.addEventListener('change', recalc);
    cLaw.addEventListener('change', recalc);
    cGType.addEventListener('change', recalc);
    cSum.addEventListener('input', recalc);
    if (cEndDate) {
      cEndDate.addEventListener('input', recalc);
      cEndDate.addEventListener('change', recalc);
    }

    if (cCopy) cCopy.addEventListener('click', function () {
      if (!lastCalc || !lastCalc.mailBody) return;
      var text = lastCalc.mailBody;
      var done = function () {
        var old = cCopy.textContent;
        cCopy.textContent = 'Скопировано ✓';
        setTimeout(function () { cCopy.textContent = old; }, 2200);
        spTrack('calculator_lead', { service: lastCalc.service, value: Math.round(lastCalc.price), method: 'copy' });
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          if (window.prompt) window.prompt('Скопируйте расчёт:', text);
        });
      } else if (window.prompt) {
        window.prompt('Скопируйте расчёт:', text);
      }
    });

    recalc();
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

  /* ---------- Счётчики ---------- */
  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1200;
    var start = null;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    setTimeout(function () { el.textContent = prefix + target + suffix; }, dur + 300);
  }

  /* ---------- Плавное появление блоков ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.reveal[data-delay]'), function (el) {
    el.style.setProperty('--d', (parseInt(el.getAttribute('data-delay'), 10) || 0) * 130 + 'ms');
  });

  var pending = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var countersLeft = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));

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

    countersLeft = countersLeft.filter(function (el) {
      if (el.getBoundingClientRect().top < limit) {
        animateCounter(el);
        return false;
      }
      return true;
    });
  }
  function onSweepScroll() {
    if (pending.length || countersLeft.length) sweep();
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
  if (canvas && !reduced) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, parts = [], rafId = null;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      var count = Math.min(70, Math.round(W / 22));
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
  function updateStickybar() {
    if (!stickybar) return;
    var pastHero = hero ? window.scrollY > hero.offsetHeight * 0.7 : window.scrollY > 320;
    var nearFooter = (window.innerHeight + window.scrollY) > (docEl.scrollHeight - 40);
    var show = pastHero && !nearFooter;
    stickybar.classList.toggle('is-visible', show);
    document.body.classList.toggle('has-stickybar', show);
  }
  window.addEventListener('scroll', updateStickybar, { passive: true });
  window.addEventListener('resize', updateStickybar);
  updateStickybar();

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
