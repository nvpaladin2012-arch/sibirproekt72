/* =========================================================
   Сибирь Проект — калькулятор независимых (банковских) гарантий
   Вынесен из main.js: загружается defer только на главной.
   События GA4: calculator_calculate, calculator_lead
   ========================================================= */
(function () {
  'use strict';

  var calcForm = document.getElementById('calcForm');
  if (!calcForm) return; /* на остальных страницах скрипт не нужен */

  /* ---------- GA4: лёгкая обёртка (работает до загрузки gtag) ---------- */
  function calcTrack(name, params) {
    try {
      if (typeof window.gtag === 'function') { window.gtag('event', name, params); return; }
      var o = { event: name }, k;
      for (k in params) if (Object.prototype.hasOwnProperty.call(params, k) && params[k] !== undefined) o[k] = params[k];
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(o);
    } catch (e) {}
  }

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
  var cChat = document.getElementById('calcChat');
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

  /* Тарифная сетка №1: только для госзакупок,
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

  /* Микроконверсия №1: факт расчёта. Debounce, чтобы не слать событие
     на каждый символ суммы; не считаем первичный рендер страницы. */
  var trackTimer = null;
  var trackedSignature = '';
  function scheduleCalculateTracking() {
    if (!lastCalc || !lastCalc.valid) return;
    var c = lastCalc;
    var signature = [c.service, c.law, c.type, c.sum, c.days, Math.round(c.price)].join('|');
    if (signature === trackedSignature) return;
    if (trackTimer) clearTimeout(trackTimer);
    trackTimer = setTimeout(function () {
      trackTimer = null;
      var cur = lastCalc;
      if (!cur || !cur.valid) return;
      var sig = [cur.service, cur.law, cur.type, cur.sum, cur.days, Math.round(cur.price)].join('|');
      if (sig === trackedSignature) return;
      trackedSignature = sig;
      calcTrack('calculator_calculate', {
        service: cur.service,
        law: cur.law,
        guarantee_type: cur.type,
        amount: cur.sum,
        term_days: cur.days,
        price: Math.round(cur.price),
        event_category: 'calculator',
        event_label: cur.law + '/' + cur.type
      });
    }, 1000);
  }

  function recalc(fromUser) {
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
    cTerm.textContent = dateOk ? 'от 4 часов (в среднем 1 рабочий день) · ' + days + ' ' + pluralDays(days) : 'от 4 часов (в среднем 1 рабочий день)';
    cSumView.textContent = s ? rub(s) : '—';
    cDays.textContent = dateOk ? days + ' ' + pluralDays(days) : '—';

    var html = '';
    for (var i = 0; i < includes.length; i++) html += '<li>' + includes[i] + '</li>';
    cInc.innerHTML = html;

    lastCalc = {
      service: service, sum: s, days: days, end: end, law: law, type: type,
      price: price, valid: valid, mailBody: ''
    };

    if (valid) {
      var lines = ['Здравствуйте! Прошу уточнить стоимость и условия.', '', 'Услуга: Независимые (банковские) гарантии'];
      lines.push('Тип закупки: ' + lawLabel[law]);
      lines.push('Вид гарантии: ' + gTypeLabel[type]);
      lines.push('Сумма гарантии: ' + rub(s));
      lines.push('Дата окончания гарантии: ' + formatDateRu(end) + ' (' + days + ' ' + pluralDays(days) + ')');
      lines.push('Предварительный расчёт: ' + rub(price));
      lines.push('Срок выпуска: от 4 часов (в среднем 1 рабочий день)');
      lines.push('', 'Расчёт с сайта sibirproekt72.ru');
      lastCalc.mailBody = lines.join('\n');
    }

    if (cCopy) cCopy.disabled = !valid;
    if (fromUser) scheduleCalculateTracking();
  }

  /* min — завтрашняя дата, по умолчанию — через год */
  var today = startOfToday();
  if (cEndDate) {
    cEndDate.min = isoDate(addDays(today, 1));
    cEndDate.value = isoDate(addDays(today, 365));
  }

  cService.addEventListener('change', function () { recalc(true); });
  cLaw.addEventListener('change', function () { recalc(true); });
  cGType.addEventListener('change', function () { recalc(true); });
  cSum.addEventListener('input', function () { recalc(true); });
  if (cEndDate) {
    cEndDate.addEventListener('input', function () { recalc(true); });
    cEndDate.addEventListener('change', function () { recalc(true); });
  }

  /* Микроконверсия №2: копирование расчёта (лид) */
  if (cCopy) cCopy.addEventListener('click', function () {
    if (!lastCalc || !lastCalc.mailBody) return;
    var text = lastCalc.mailBody;
    var done = function () {
      var old = cCopy.textContent;
      cCopy.textContent = 'Скопировано ✓';
      setTimeout(function () { cCopy.textContent = old; }, 2200);
      calcTrack('calculator_lead', {
        service: lastCalc.service, value: Math.round(lastCalc.price),
        method: 'copy', amount: lastCalc.sum, term_days: lastCalc.days,
        event_category: 'calculator'
      });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        if (window.prompt) window.prompt('Скопируйте расчёт:', text);
      });
    } else if (window.prompt) {
      window.prompt('Скопируйте расчёт:', text);
    }
  });

  /* Микроконверсия №3: расчёт → анонимный чат (лид) */
  if (cChat) cChat.addEventListener('click', function () {
    var c = lastCalc || {};
    calcTrack('calculator_lead', {
      service: c.service || 'guarantee', value: c.price ? Math.round(c.price) : 0,
      method: 'chat', amount: c.sum || 0, term_days: c.days || 0,
      event_category: 'calculator'
    });
    var calcText = 'Здравствуйте! Прошу уточнить стоимость и условия банковской гарантии по данным из калькулятора на сайте sibirproekt72.ru.';
    if (lastCalc && lastCalc.valid) {
      calcText = 'Хочу обсудить расчёт гарантии: ' +
        (lawLabel[lastCalc.law] || '44-ФЗ') + ', ' +
        (gTypeLabel[lastCalc.type] || 'на исполнение контракта') + ', ' +
        'сумма ' + rub(lastCalc.sum) + ', срок ' + lastCalc.days + ' дней. ' +
        'Предварительный расчёт: ' + rub(lastCalc.price) + '.';
    }
    if (typeof window.SibirProektGigaChatWidgetSend === 'function') { window.SibirProektGigaChatWidgetSend(calcText); return; }
    if (typeof window.SibirProektLoadChatWidget === 'function') window.SibirProektLoadChatWidget();
    if (typeof window.SibirProektGigaChatWidgetOpen === 'function') { window.SibirProektGigaChatWidgetOpen(); return; }
    var launcher = document.querySelector('.spw-launcher');
    if (launcher) launcher.click();
  });

  recalc(false);
})();
