// Shared full-site search over window.SEARCH_INDEX (built by scripts/build-search-index.js).
// siteSearch(q, limit) -> { groups, rows, results: [{ href, page, tab, count, snips: [{a, m, b}] }] }
(function () {
  window.siteSearch = function (q, limit) {
    var terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return { groups: 0, rows: 0, results: [] };
    var labels = window.SEARCH_LABELS || {};
    var by = new Map();
    var rows = 0;
    var index = window.SEARCH_INDEX || [];
    for (var n = 0; n < index.length; n++) {
      var r = index[n];
      var low = r.x.toLowerCase();
      if (!terms.every(function (t) { return low.indexOf(t) !== -1; })) continue;
      rows++;
      var key = r.p + '\u0000' + r.t;
      var g = by.get(key);
      if (!g) {
        g = { p: r.p, t: r.t, n: 0, hits: [], nameHit: terms.every(function (t) { return r.t.toLowerCase().indexOf(t) !== -1; }) };
        by.set(key, g);
      }
      g.n++;
      if (g.hits.length < 3 && r.x !== r.t) g.hits.push(r.x);
    }
    var list = Array.from(by.values()).sort(function (a, b) { return (b.nameHit - a.nameHit) || (b.n - a.n); });
    var qs = encodeURIComponent(String(q).trim());
    var results = list.slice(0, limit || 40).map(function (g) {
      return {
        href: g.p + '.dc.html?q=' + qs + '#' + encodeURIComponent(g.t),
        page: labels[g.p] || g.p, tab: g.t, count: g.n,
        snips: g.hits.map(function (x) {
          var low = x.toLowerCase();
          var t = terms.find(function (w) { return low.indexOf(w) !== -1; }) || terms[0];
          var k = Math.max(0, low.indexOf(t));
          var from = Math.max(0, k - 24);
          return {
            a: (from > 0 ? '…' : '') + x.slice(from, k),
            m: x.slice(k, k + t.length),
            b: x.slice(k + t.length, k + t.length + 60) + (k + t.length + 60 < x.length ? '…' : '')
          };
        })
      };
    });
    return { groups: list.length, rows: rows, results: results };
  };
})();
