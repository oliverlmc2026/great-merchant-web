// Builds the 任務流程 page (data + html + images) from the gersangelacal.com mission export.
// Usage: node scripts/build-quests.js [srcDir]
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || '/Users/oliver/Desktop/任務流程';
const DIR = path.join(__dirname, '..', 'jushang-db');
const IMG_OUT = path.join(DIR, 'quest');

const usedImages = new Set();
const missingImages = new Set();
const unknown = [];

// "- ![alt|32](images/x.webp) **中** / EN × 3（來源）" → { img, name, en, n, note }
function item(line) {
  const m = line.match(/^-\s+(?:!\[[^\]]*\]\(images\/([^)]+)\)\s*)?(.+?)\s+×\s+([\d,]+)(?:（(.+)）)?\s*$/);
  if (!m) return null;
  const [name, ...en] = m[2].replace(/\*\*/g, '').split(' / ');
  if (m[1]) {
    if (fs.existsSync(path.join(SRC, 'images', m[1]))) usedImages.add(m[1]);
    else missingImages.add(m[1]);
  }
  return { img: m[1] && !missingImages.has(m[1]) ? m[1] : null, name: name.trim(), en: en.join(' / ').trim(), n: m[3], note: m[4] || '' };
}

const cell = (t, img) => ({ t, i: img ? [img] : [] });

function parse(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^---[\s\S]*?---\n/, '').split('\n');
  const mats = [];
  const rewards = [];
  const steps = [];
  let sec = '';
  let sub = '';
  let last = null;
  for (const line of lines) {
    if (!line.trim() || line.startsWith('# ') || line.trim() === '---') continue;
    if (line.startsWith('>')) { if (sec === '任務步驟') steps.push({ note: line.replace(/^>\s*/, '') }); continue; }
    let h;
    if ((h = line.match(/^## (.+)/))) { sec = h[1].trim(); sub = ''; last = null; continue; }
    if ((h = line.match(/^### (.+)/))) { steps.push({ title: h[1].trim(), en: '', kv: [], parts: [] }); sub = ''; last = null; continue; }
    if ((h = line.match(/^\*\*(.+)\*\*$/))) { sub = h[1]; last = null; continue; }
    const step = steps[steps.length - 1];
    if (sec === '任務步驟' && step && !sub && (h = line.match(/^\*(.+)\*$/))) { step.en = h[1]; continue; }
    if ((h = line.match(/^\s+-\s+(.+?)：(.*)$/)) && last) { last.drops.push(h[1] + '：' + h[2].trim()); continue; }
    if (sec === '任務步驟' && step && !sub && (h = line.match(/^-\s+(.+?)：(.*)$/))) { step.kv.push([h[1], h[2].trim()]); continue; }
    const it = item(line);
    if (it) {
      it.drops = [];
      last = it;
      if (sec === '任務材料總結') mats.push(it);
      else if (sec === '任務獎勵一覽') rewards.push(it);
      else if (sec === '任務步驟' && step && sub) step.parts.push([sub, it]);
      else unknown.push(path.basename(file) + ': ' + line);
      continue;
    }
    if (sec === '任務步驟' && step && sub && (h = line.match(/^-\s+(.+)$/))) { step.parts.push([sub, { name: h[1], en: '', n: '', drops: [] }]); continue; }
    unknown.push(path.basename(file) + ': ' + line);
  }

  const groups = [];
  const drop = (it, key) => (it.drops.find((d) => d.startsWith(key)) || '').replace(/^[^：]+：/, '');
  if (mats.length) groups.push({ pre: true, th: true, title: '任務材料總結', rows: [
    ['物品', '英文', '數量', '掉落地點', '掉落怪物'].map((t) => cell(t)),
    ...mats.map((it) => [cell(it.name, it.img), cell(it.en), cell(it.n), cell(drop(it, '掉落地點')), cell(drop(it, '掉落怪物'))])
  ] });
  if (rewards.length) groups.push({ pre: true, th: true, title: '任務獎勵一覽', rows: [
    ['物品', '英文', '數量', '來源任務'].map((t) => cell(t)),
    ...rewards.map((it) => [cell(it.name, it.img), cell(it.en), cell(it.n), cell(it.note)])
  ] });
  for (const s of steps) {
    if (s.note) { groups.push({ pre: true, title: '', rows: [[cell(s.note)]] }); continue; }
    const rows = [];
    if (s.en) rows.push([cell('英文名稱'), cell(s.en)]);
    for (const [k, v] of s.kv) rows.push([cell(k), cell(v)]);
    for (const [k, it] of s.parts) {
      const t = [it.name + (it.en ? ' / ' + it.en : '') + (it.n ? ' × ' + it.n : ''), ...it.drops].join('\n');
      rows.push([cell(k), cell(t, it.img)]);
    }
    groups.push({ pre: true, title: s.title, en: s.en, rows });
  }
  return { groups, steps: steps.filter((s) => !s.note).length };
}

// [category, note, files]; a file name may map to a display name with [file, name]
const DAILY = /^每日·/;
const WEEKLY = /^每週·/;
const CATS = [
  ['通行證', '通行證＝只解到拎到通行證而唔影響轉國 reset 任務', ['地下神殿', ['峽谷', '峽谷通行證'], ['藏身處', '藏身處通行證'], ['黎明谷', '黎明谷通行證'], ['日落谷', '日落谷通行證'], '香巴拉天獄', '香巴拉關口', '激戰香巴拉', '星座相關', '黑色商團黑市', '黑色商團黑市秘密特工', '紅焰城樓']],
  ['修練書相關', '', ['一轉主角', '白商會', '玄武團', '白虎團', '破奧之塔', '尼泊爾', '印度北部', '印度東部', '提婆寺院', '廢棄海岸寺院', '冰城', '帝王陵墓', '齊天大聖']],
  ['籠罩之影', '', ['千年湖', '黑色商團野營地入口', '小玲的後院', '黑色商團野營地', '隆山1層', '少林寺入口', '冰雪神神殿', '禮堂內部']],
  ['其他主線', '', ['匡廬山山頂', '神仙谷', '神仙谷入口', '秘密宅邸', '靈魂村', '順天下方', '須彌山', '須彌山十二時']],
  ['特殊任務', '', ['二轉', '傳說精靈', '坐騎', '巨商修練書', '新手軍營', '武器共鳴', '試煉']],
  ['每日任務', '', DAILY],
  ['每週任務', '', WEEKLY]
];

const files = [...fs.readFileSync(path.join(SRC, '00_索引.md'), 'utf8').matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
const tabs = CATS.flatMap(([cat, catNote, list]) => (list instanceof RegExp ? files.filter((f) => list.test(f)) : list)
  .map((e) => { const [file, name] = Array.isArray(e) ? e : [e, e]; return { file, name, cat, catNote, label: name.replace(/^每[日週]·/, '') }; }));
const unplaced = files.filter((f) => !tabs.some((t) => t.file === f));
if (unplaced.length || tabs.length !== files.length) throw new Error('category list out of sync with 00_索引.md: ' + unplaced.join(', '));

let stepCount = 0;
const data = tabs.map(({ file, name, cat, catNote, label }) => {
  const { groups, steps } = parse(path.join(SRC, file + '.md'));
  stepCount += steps;
  return { name, label, cat, catNote, meta: '任務數量：' + steps, groups, extra: [] };
});

fs.writeFileSync(path.join(DIR, 'Quest-data.js'), 'window.UNITS_DATA=' + JSON.stringify(data) + ';\n');
const tpl = fs.readFileSync(path.join(__dirname, 'dex-template.html'), 'utf8')
  .replace(/__LABEL__/g, '任務流程').replace(/__KEY__/g, 'Quest').replace(/__IMG__/g, 'quest/')
  .replace(/__BLURB__/g, '主線、地區、每日與每週任務嘅步驟、所需材料、擊敗目標與獎勵（資料來源 gersangelacal.com）。');
fs.writeFileSync(path.join(DIR, 'Quest.dc.html'), tpl);
fs.rmSync(IMG_OUT, { recursive: true, force: true });
fs.mkdirSync(IMG_OUT, { recursive: true });
for (const f of usedImages) fs.copyFileSync(path.join(SRC, 'images', f), path.join(IMG_OUT, f));
console.log('tabs:', data.length, 'steps:', stepCount, 'images:', usedImages.size, 'missing:', [...missingImages], 'unparsed:', unknown);
