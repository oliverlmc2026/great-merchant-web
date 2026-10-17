// Search box at the top of each category page. Loads the search index on first use,
// then links straight to the matching tab (highlight.js highlights the terms there).
(function () {
  var MAX = 20;

  function mk(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  var ready = null;
  function ensureLoaded() {
    if (!ready) {
      ready = (window.SEARCH_INDEX ? Promise.resolve() : loadScript('./search-data.js'))
        .then(function () { return window.siteSearch ? null : loadScript('./search.js'); });
    }
    return ready;
  }

  function build() {
    var wrap = mk('div', 'position:relative;z-index:50;width:100%;box-sizing:border-box');
    wrap.id = 'page-search';
    var input = mk('input', 'width:100%;min-height:44px;box-sizing:border-box;padding:0 16px;border-radius:8px;border:1px solid #3a444c;background:#1c2328;color:#e8e4da;font-family:inherit;font-size:16px;outline:none');
    input.type = 'search';
    input.placeholder = '搜尋全站內容（多個字用空格分隔）';
    input.setAttribute('aria-label', '搜尋全站內容');
    input.value = new URLSearchParams(location.search).get('q') || '';
    var panel = mk('div', 'display:none;position:absolute;left:0;right:0;top:100%;margin-top:6px;max-height:60vh;overflow:auto;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #3a444c;background:#14181c;box-shadow:0 12px 32px rgba(0,0,0,.6);flex-direction:column;gap:8px');
    wrap.appendChild(input);
    wrap.appendChild(panel);

    function hide() { panel.style.display = 'none'; }
    function render() {
      var q = input.value.trim();
      if (!q) { hide(); return; }
      var S = window.siteSearch(q, MAX);
      panel.textContent = '';
      panel.style.display = 'flex';
      panel.appendChild(mk('div', 'font-size:13px;color:#aab2b8;padding:0 4px',
        S.groups ? '搵到 ' + S.groups + ' 個分頁、共 ' + S.rows + ' 筆相符' + (S.groups > MAX ? '（只顯示最相關嘅 ' + MAX + ' 個）' : '') : '搵唔到相符內容，試下用較短嘅關鍵字。'));
      S.results.forEach(function (r) {
        var a = mk('a', 'display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid #2c353c;background:#1c2328;border-radius:6px;color:#e8e4da;text-decoration:none');
        a.href = r.href;
        var head = mk('div', 'display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:15px;font-weight:700');
        var title = mk('span');
        title.appendChild(mk('span', 'color:#c9a24b', r.page));
        title.appendChild(document.createTextNode(' › ' + r.tab));
        head.appendChild(title);
        head.appendChild(mk('span', 'font-size:12px;color:#d2553a;white-space:nowrap', r.count + ' 筆相符 →'));
        a.appendChild(head);
        r.snips.slice(0, 2).forEach(function (sn) {
          var line = mk('div', 'font-size:13px;line-height:1.6;color:#aab2b8');
          line.appendChild(document.createTextNode(sn.a));
          line.appendChild(mk('span', 'color:#14181c;background:#c9a24b;border-radius:2px;padding:0 2px', sn.m));
          line.appendChild(document.createTextNode(sn.b));
          a.appendChild(line);
        });
        panel.appendChild(a);
      });
    }

    var timer = null;
    function onInput() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        ensureLoaded().then(render).catch(function () {
          panel.textContent = '';
          panel.style.display = 'flex';
          panel.appendChild(mk('div', 'font-size:13px;color:#d2553a', '搜尋索引載入失敗，請重新整理。'));
        });
      }, 120);
    }
    input.addEventListener('input', onInput);
    input.addEventListener('focus', function () { ensureLoaded(); if (input.value.trim() && panel.childNodes.length) panel.style.display = 'flex'; });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hide(); input.blur(); }
      else if (e.key === 'Enter') {
        var a = panel.querySelector('a');
        if (a) location.href = a.href;
      }
    });
    document.addEventListener('mousedown', function (e) { if (!wrap.contains(e.target)) hide(); });
    return wrap;
  }

  // Mount into the in-template slot (below the header divider). The framework may re-render,
  // so keep one search box and re-attach it whenever the slot is empty again.
  var wrapEl = null;
  function mount() {
    var slot = document.getElementById('page-search-slot');
    if (slot) {
      if (!wrapEl) wrapEl = build();
      if (wrapEl.parentNode !== slot) slot.appendChild(wrapEl);
      return true;
    }
    return false;
  }
  function start() {
    if (mount()) { observe(); return; }
    observe();
    // no slot after the page has rendered: fall back to the top of the page
    setTimeout(function () {
      if (!document.getElementById('page-search-slot') && !wrapEl) {
        wrapEl = build();
        wrapEl.style.cssText += ';max-width:1280px;margin:0 auto;padding:12px 16px 0';
        document.body.insertBefore(wrapEl, document.body.firstChild);
      }
    }, 4000);
  }
  function observe() {
    new MutationObserver(function () { mount(); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
