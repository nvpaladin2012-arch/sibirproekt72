(function () {
  'use strict';

  var PATH_RE = /^\/(articles|news)\/.+\.html$/i;
  var INDEX_RE = /^\/(articles|news)\/index\.html$/i;
  var path = window.location.pathname || '';
  if (!PATH_RE.test(path) || INDEX_RE.test(path)) return;
  if (!document.querySelector('.article-page__body')) return;

  var READ_MS = 30000;
  var SCROLL_THRESHOLD = 0.85;
  var END_SELECTOR = '.article-nav';

  var sent = false;
  var timeOk = false;
  var scrollOk = false;
  var timerId = null;
  var visibleMs = 0;
  var lastVisibleAt = document.visibilityState === 'visible' ? Date.now() : null;
  var scrollRaf = null;

  function getArticleTitle() {
    var h1 = document.querySelector('h1.article-page__title, h1');
    var text = h1 ? h1.textContent : document.title;
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function getScrollRatio() {
    var doc = document.documentElement;
    var body = document.body;
    var viewport = window.innerHeight || doc.clientHeight || 0;
    var fullHeight = Math.max(
      body.scrollHeight, body.offsetHeight,
      doc.clientHeight, doc.scrollHeight, doc.offsetHeight
    );
    if (fullHeight <= 0) return 0;
    return (viewport + (window.pageYOffset || doc.scrollTop || body.scrollTop || 0)) / fullHeight;
  }

  function endElementReached() {
    var el = document.querySelector(END_SELECTOR);
    if (!el) return false;
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    return r.top < vh && r.bottom > 0;
  }

  function isRead() {
    return endElementReached() || getScrollRatio() >= SCROLL_THRESHOLD;
  }

  function cleanup() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function currentVisibleMs() {
    var now = Date.now();
    return visibleMs + (lastVisibleAt ? (now - lastVisibleAt) : 0);
  }

  function sendArticleRead() {
    if (sent || !timeOk || !scrollOk) return;
    sent = true;

    var payload = {
      event: 'article_read',
      article_title: getArticleTitle(),
      article_path: path,
      article_url: window.location.href,
      article_read_time_sec: Math.round(currentVisibleMs() / 1000),
      page_type: path.indexOf('/news/') === 0 ? 'news' : 'article'
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'article_read', {
        article_title: payload.article_title,
        article_path: payload.article_path,
        article_url: payload.article_url,
        article_read_time_sec: payload.article_read_time_sec,
        page_type: payload.page_type
      });
    }

    cleanup();
  }

  function checkScroll() {
    if (sent) return;
    if (isRead()) {
      scrollOk = true;
      sendArticleRead();
    }
  }

  function tickTime() {
    if (sent) return;
    if (currentVisibleMs() >= READ_MS) {
      timeOk = true;
      sendArticleRead();
    }
  }

  function onVisibilityChange() {
    var now = Date.now();
    if (document.visibilityState === 'visible') {
      if (!lastVisibleAt) lastVisibleAt = now;
      return;
    }
    if (lastVisibleAt) {
      visibleMs += now - lastVisibleAt;
      lastVisibleAt = null;
    }
  }

  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = window.requestAnimationFrame(function () {
      scrollRaf = null;
      checkScroll();
    });
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  timerId = window.setInterval(tickTime, 1000);

  checkScroll();
  tickTime();
})();
