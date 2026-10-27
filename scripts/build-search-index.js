// Builds jushang-db/search-data.js (text-only search index, no images).
// Usage: node scripts/build-search-index.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DIR = path.join(__dirname, '..', 'jushang-db');
const PAGE_LABEL = {
  Newbie: '新手入門', Kings: '四天王', Beasts: '兇獸', Units: '將帥與傭兵',
  Sys: '主角與系統', Equip: '裝備', Prod: '生產與商團', Inst: '副本與活動', Ver: '版本與公告',
  Dex: '傭兵與數據圖鑑', Gear: '裝備圖鑑', Guide: '攻略與筆記', Quest: '任務流程', Drop: '怪物掉落價值'
};
const clean = (s) => String(s).replace(/\s+/g, ' ').trim();
const out = [];
const add = (p, tab, text) => { text = clean(text); if (text) out.push({ p, t: tab, x: text }); };

// 1) Data-file pages: rows of cells {t, i}
for (const p of ['Units', 'Sys', 'Equip', 'Prod', 'Inst', 'Ver', 'Dex', 'Gear', 'Guide', 'Quest']) {
  const f = p === 'Units' ? 'units-data.js' : p + '-data.js';
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx);
  for (const sec of ctx.window.UNITS_DATA) {
    add(p, sec.name, sec.name);
    for (const g of sec.groups) for (const r of g.rows) add(p, sec.name, r.map((c) => c.t || '').join(' '));
  }
}

// 2) 怪物掉落價值: one tab per map (國家·地圖), one row per monster with its drops
{
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'Drop-data.js'), 'utf8'), ctx);
  const { countries, items } = ctx.window.DROP_DATA;
  const bi = (r) => (r.englishName && r.englishName !== r.name ? r.name + ' / ' + r.englishName : r.name);
  for (const c of countries) for (const m of c.maps) {
    const tab = c.name + '·' + m.name;
    add('Drop', tab, tab + ' ' + bi(m));
    for (const mo of m.monsters) add('Drop', tab, bi(mo) + '：' + mo.drops.map((d) => items[d.itemId] && items[d.itemId].name).filter(Boolean).join('、'));
  }
}

// 3) Inline pages: run the page's component with a stub DCLogic and collect rendered strings
const SKIP_KEYS = new Set(['bg', 'fg', 'border', 'tagColor', 'img', 'imgs', 'extra', 'pick', 'on']);
const collect = (v, acc, key) => {
  if (typeof v === 'string') {
    if (SKIP_KEYS.has(key) || /^(#|blob\/|data:)/.test(v)) return;
    acc.push(v);
  } else if (Array.isArray(v)) v.forEach((x) => collect(x, acc, key));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) collect(v[k], acc, k);
};
for (const [p, nameOf] of [['Newbie', (t) => t.name], ['Kings', (t) => t.name], ['Beasts', (t) => t.name]]) {
  const html = fs.readFileSync(path.join(DIR, p + '.dc.html'), 'utf8');
  const code = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const ctx = {
    window: { addEventListener() {} }, location: { hash: '' },
    DCLogic: class { constructor(p) { this.props = p || {}; this.state = {}; } setState(s) { Object.assign(this.state, s); } },
    console
  };
  vm.createContext(ctx);
  const Comp = vm.runInContext('(() => {' + code + '\nreturn Component; })()', ctx);
  const inst = new Comp({});
  inst.state.i = 0;
  const first = inst.renderVals();
  const names = first.tabs.map(nameOf);
  names.forEach((name, j) => {
    inst.state.i = j;
    const acc = [];
    collect(inst.renderVals(), acc, '');
    const seen = new Set();
    add(p, name, name);
    for (const s of acc) { const c = clean(s); if (c && !seen.has(c)) { seen.add(c); add(p, name, c); } }
  });
}

const meta = Object.entries(PAGE_LABEL).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',');
const body = 'window.SEARCH_LABELS={' + meta + '};\nwindow.SEARCH_INDEX=' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(DIR, 'search-data.js'), body);
const by = {};
out.forEach((r) => { by[r.p] = (by[r.p] || 0) + 1; });
console.log('rows:', out.length, 'bytes:', Buffer.byteLength(body), by);
