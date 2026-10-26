// Builds Dex/Gear/Guide pages (data + html + images) from the Obsidian vault's wiki notes.
// Usage: node scripts/build-dex.js [vaultDir]
const fs = require('fs');
const path = require('path');

const VAULT = process.argv[2] || '/Users/oliver/Library/Mobile Documents/iCloud~md~obsidian/Documents/my巨商資料庫';
const DIR = path.join(__dirname, '..', 'jushang-db');
const IMG_OUT = path.join(DIR, 'dex');
const ASSET_DIRS = ['巨商傭兵圖鑑', '巨商裝備圖鑑'].map((d) => path.join(VAULT, 'raw', 'assets', d));

const SRC = (n) => path.join(VAULT, 'wiki', 'sources', '來源-' + n + '.md');
const ANA = (n) => path.join(VAULT, 'wiki', 'analyses', n + '.md');

const PAGES = {
  Dex: {
    label: '傭兵與數據圖鑑',
    blurb: 'gersangelacal.com 傭兵圖鑑與經驗、信用度、靈魂石數據表。',
    tabs: [
      ['巨商傭兵圖鑑', SRC('巨商傭兵圖鑑')],
      ['巨商戰鬥經驗等級表', SRC('巨商戰鬥經驗等級表')],
      ['巨商信用度經驗表', SRC('巨商信用度經驗表')],
      ['巨商英雄靈魂石', SRC('巨商英雄靈魂石')]
    ]
  },
  Gear: {
    label: '裝備圖鑑',
    blurb: 'gersangelacal.com 裝備圖鑑：各部位裝備能力、套裝效果與取得方法。',
    tabs: [
      ['套裝效果', SRC('巨商裝備圖鑑-套裝效果')],
      ['頭部裝備', SRC('巨商裝備圖鑑-頭')], ['甲（胸甲）', SRC('巨商裝備圖鑑-甲')],
      ['手部裝備', SRC('巨商裝備圖鑑-手')], ['腰部裝備', SRC('巨商裝備圖鑑-腰')],
      ['鞋子', SRC('巨商裝備圖鑑-鞋')], ['戒指', SRC('巨商裝備圖鑑-戒指')],
      ['耳環', SRC('巨商裝備圖鑑-耳環')], ['項鍊', SRC('巨商裝備圖鑑-項鍊')],
      ['手鐲', SRC('巨商裝備圖鑑-手鐲')], ['綁腿', SRC('巨商裝備圖鑑-綁腿')],
      ['氣運', SRC('巨商裝備圖鑑-氣運')], ['娃娃', SRC('巨商裝備圖鑑-娃娃')],
      ['主角娃娃', SRC('巨商裝備圖鑑-主角娃娃')],
      ['覺醒天王武器', SRC('巨商裝備圖鑑-覺醒天王武器')], ['覺醒天王符', SRC('巨商裝備圖鑑-覺醒天王符')],
      ['明王武器', SRC('巨商裝備圖鑑-明王武器')], ['明王符', SRC('巨商裝備圖鑑-明王符')]
    ]
  },
  Guide: {
    label: '攻略與筆記',
    blurb: '抗性公式、羈絆系統、娃娃比較、經驗算法、別名術語對照與巴哈玩家心得。',
    tabs: [
      ['抗性詳解', ANA('抗性詳解')],
      ['巴哈巨商補給站心得', SRC('巴哈巨商補給站心得')],
      ['羈絆系統', ANA('羈絆系統')],
      ['鍾娃與藍娃比較', ANA('鍾娃與藍娃比較')],
      ['別名和術語對照表', ANA('別名和術語對照表')],
      ['常用查詢網站', ANA('常用查詢網站')],
      ['經驗算法', ANA('經驗算法')]
    ]
  }
};

const SKIP_HEADINGS = /^(本資料更新了哪些 Wiki 頁面|與現有知識的關係|值得深入探索的問題|引用的 Wiki 頁面|待解問題 ?\/ ?後續探索|引用來源|相關頁面|延伸閱讀|各類型數量)/;

const usedImages = new Set();
const missingImages = new Set();

function inline(s, imgs) {
  s = s.replace(/\\\|/g, '|');
  s = s.replace(/來源-/g, '').replace(/^\[![A-Za-z]+\]\s*/, '');
  s = s.replace(/!\[\[([^\]|\\]+)(?:\\?\|[^\]]*)?\]\]/g, (_, f) => { imgs.push(f.trim()); return ''; });
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 $2');
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\\\|/g, '|');
  return s.trim();
}

const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/);

function parse(file) {
  let md = fs.readFileSync(file, 'utf8').replace(/^---[\s\S]*?---\n/, '');
  const lines = md.split('\n');
  const groups = [];
  let cur = null;
  let inCode = false;
  let skipping = false;
  let afterH1 = false;
  const open = (title) => { cur = { title, blocks: [] }; groups.push(cur); };
  open('');
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    const h = !inCode && line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const lvl = h[1].length;
      if (lvl === 1) { afterH1 = true; continue; }
      const title = inline(h[2], []).replace(/^[一二三四五六七八九十]+、/, '');
      skipping = SKIP_HEADINGS.test(title);
      open(title);
      continue;
    }
    if (skipping) continue;
    if (afterH1 && cur.title === '' && (line.startsWith('>') || line.trim() === '---' )) continue;
    if (/^\s*---\s*$/.test(line)) continue;
    if (!inCode && line.startsWith('|') && /^\|[\s:|-]+\|?\s*$/.test(lines[k + 1] || '')) {
      const hdr = splitRow(line);
      k += 2;
      const rows = [];
      while (k < lines.length && lines[k].startsWith('|')) { rows.push(splitRow(lines[k])); k++; }
      k--;
      cur.blocks.push({ table: [hdr, ...rows] });
      continue;
    }
    if (!line.trim()) continue;
    if (!inCode && /raw\/assets|SHA-256|原網頁的 80/.test(line)) continue;
    const text = inCode ? line : line.replace(/^>\s?/, '').replace(/^\s*[-*]\s+/, '• ');
    cur.blocks.push({ text });
  }
  return groups;
}

function toGroups(parsed) {
  const out = [];
  for (const g of parsed) {
    let textRows = [];
    const flush = () => { if (textRows.length) { out.push({ pre: true, title: g.title, rows: textRows }); textRows = []; } };
    let titled = false;
    const take = () => { const t = titled ? '' : g.title; titled = true; return t; };
    for (const b of g.blocks) {
      if (b.text !== undefined) {
        const imgs = [];
        const t = inline(b.text, imgs);
        if (t || imgs.length) textRows.push([{ t, i: imgs }]);
      } else {
        if (textRows.length) { out.push({ pre: true, title: take(), rows: textRows }); textRows = []; }
        const rows = b.table.map((r) => r.map((c) => { const imgs = []; const t = inline(c, imgs); return { t, i: imgs }; }));
        out.push({ pre: true, th: true, title: take(), rows });
      }
    }
    if (textRows.length) out.push({ pre: true, title: take(), rows: textRows });
    else if (!g.blocks.length && g.title && !out.length) out.push({ pre: true, title: g.title, rows: [] });
  }
  for (const g of out) for (const r of g.rows) for (const c of r) {
    c.i = c.i.map((f) => {
      const hit = ASSET_DIRS.map((d) => path.join(d, f)).find((p) => fs.existsSync(p));
      if (!hit) { missingImages.add(f); return null; }
      usedImages.add(hit);
      return f;
    }).filter(Boolean);
  }
  return out.filter((g) => g.rows.length);
}

fs.mkdirSync(IMG_OUT, { recursive: true });
const stats = {};
for (const [key, cfg] of Object.entries(PAGES)) {
  const data = cfg.tabs.map(([name, file]) => ({ name, groups: toGroups(parse(file)), extra: [] }));
  fs.writeFileSync(path.join(DIR, key + '-data.js'), 'window.UNITS_DATA=' + JSON.stringify(data) + ';\n');
  const tpl = fs.readFileSync(path.join(__dirname, 'dex-template.html'), 'utf8')
    .replace(/__LABEL__/g, cfg.label).replace(/__KEY__/g, key).replace(/__BLURB__/g, cfg.blurb).replace(/__IMG__/g, 'dex/');
  fs.writeFileSync(path.join(DIR, key + '.dc.html'), tpl);
  stats[key] = data.map((d) => d.name + ':' + d.groups.length);
}
for (const p of usedImages) fs.copyFileSync(p, path.join(IMG_OUT, path.basename(p)));
console.log(stats, 'images:', usedImages.size, 'missing:', [...missingImages]);
