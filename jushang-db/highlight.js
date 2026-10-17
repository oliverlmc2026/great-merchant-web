// Highlights the ?q=... search terms on a category page, scrolls to the first match,
// and lets the reader step through matches with prev/next buttons.
// Uses the CSS Custom Highlight API so the framework-rendered DOM is never modified.
(function () {
  var params = new URLSearchParams(location.search);
  var raw = (params.get('q') || '').trim();
  if (!raw || !window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
  var terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return;

  var style = document.createElement('style');
  style.textContent = '::highlight(search-hit){background:#c9a24b;color:#14181c}' +
    '::highlight(search-hit-current){background:#d2553a;color:#14181c}' +
    '#search-hit-pill{position:fixed;left:50%;transform:translateX(-50%);top:16px;z-index:9999;display:flex;align-items:center;gap:6px;' +
    'padding:6px 8px 6px 14px;border-radius:999px;background:#1c2328;border:1px solid #c9a24b;color:#e8e4da;' +
    'font:700 14px "Noto Sans TC",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5);max-width:calc(100vw - 32px)}' +
    '#search-hit-pill .lbl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#search-hit-pill .cnt{color:#c9a24b;white-space:nowrap}' +
    '#search-hit-pill button{all:unset;cursor:pointer;box-sizing:border-box;min-width:32px;height:32px;display:flex;' +
    'align-items:center;justify-content:center;border-radius:50%;color:#c9a24b;font-size:16px;line-height:1}' +
    '#search-hit-pill button:hover{background:#2c353c}' +
    '#search-hit-pill button:focus-visible{outline:2px solid #c9a24b}';
  document.head.appendChild(style);

  var pill = null, cntEl = null, timer = null, scrolled = false, off = false;
  var ranges = [], cur = 0;

  function mk(tag, text, cls) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  function makePill() {
    pill = mk('div');
    pill.id = 'search-hit-pill';
    var label = mk('span', '高亮：' + raw, 'lbl');
    cntEl = mk('span', '', 'cnt');
    var prev = mk('button', '↑'), next = mk('button', '↓'), close = mk('button', '✕');
    [[prev, '上一個'], [next, '下一個'], [close, '清除高亮']].forEach(function (p) {
      p[0].type = 'button';
      p[0].setAttribute('aria-label', p[1]);
      p[0].title = p[1];
    });
    prev.onclick = function () { step(-1); };
    next.onclick = function () { step(1); };
    close.onclick = function () {
      off = true;
      CSS.highlights.delete('search-hit');
      CSS.highlights.delete('search-hit-current');
      pill.remove();
      var u = new URL(location.href);
      u.searchParams.delete('q');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    };
    [label, cntEl, prev, next, close].forEach(function (e) { pill.appendChild(e); });
    document.body.appendChild(pill);
  }

  function showCurrent(scroll) {
    if (!ranges.length) return;
    var r = ranges[cur];
    var h = new Highlight(r);
    h.priority = 1;
    CSS.highlights.set('search-hit-current', h);
    cntEl.textContent = (cur + 1) + '/' + ranges.length;
    if (scroll) {
      var el = r.startContainer.parentElement;
      if (el) el.scrollIntoView({ block: 'center' });
    }
  }

  function step(d) {
    if (!ranges.length) return;
    cur = (cur + d + ranges.length) % ranges.length;
    showCurrent(true);
  }

  function apply() {
    if (off || !document.body) return;
    var root = document.body;
    var found = [], best = null, first = null, tries = 0;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || p.closest('script,style,input,textarea,#search-hit-pill')) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      var low = node.nodeValue.toLowerCase();
      var inNode = [];
      for (var t = 0; t < terms.length; t++) {
        var from = 0, k;
        while ((k = low.indexOf(terms[t], from)) !== -1) {
          var r = new Range();
          r.setStart(node, k);
          r.setEnd(node, k + terms[t].length);
          inNode.push(r);
          from = k + terms[t].length;
        }
      }
      if (!inNode.length) continue;
      inNode.sort(function (a, b) { return a.startOffset - b.startOffset; });
      if (!best && tries++ < 30) {
        // prefer a match whose nearby container holds every term (mirrors the row-level search)
        var el = node.parentElement, ok = null;
        for (var up = 0; el && el !== root && up < 8; up++, el = el.parentElement) {
          var tc = el.textContent.toLowerCase();
          if (terms.every(function (w) { return tc.indexOf(w) !== -1; })) { ok = el; break; }
        }
        if (ok && ok.textContent.length < 4000) best = inNode[0];
        else if (!first) first = inNode[0];
      }
      for (var i = 0; i < inNode.length; i++) found.push(inNode[i]);
    }
    ranges = found;
    if (!ranges.length) {
      CSS.highlights.delete('search-hit');
      CSS.highlights.delete('search-hit-current');
      if (cntEl) cntEl.textContent = '0/0';
      return;
    }
    CSS.highlights.set('search-hit', new Highlight(...ranges));
    if (!pill) makePill();
    if (!scrolled) {
      scrolled = true;
      var target = best || first;
      cur = Math.max(0, ranges.indexOf(target));
      showCurrent(true);
    } else {
      if (cur >= ranges.length) cur = 0;
      showCurrent(false);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 150);
  }

  function start() {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var tg = muts[i].target;
        var el = tg.nodeType === 1 ? tg : tg.parentElement;
        if (el && el.closest && el.closest('#search-hit-pill')) continue;
        schedule();
        return;
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
