// Builds the 怪物掉落價值 page data (Drop-data.js) and images from gersangelacal.com/monsterdrop.
// Usage: node scripts/build-drop.js   (images already on disk are kept, so reruns only fetch new ones)
const fs = require('fs');
const path = require('path');

const SITE = 'https://gersangelacal.com/';
const DIR = path.join(__dirname, '..', 'jushang-db');
const IMG_DIR = 'drop/';

const getJson = async (p) => {
  const r = await fetch(SITE + p);
  if (!r.ok) throw new Error(p + ': HTTP ' + r.status);
  return r.json();
};

// same normalisation the source page uses to look up item-usage.json by item name
function usageKey(name) {
  let text = String(name || '').trim().normalize('NFKC');
  text = text.replace(/隆/g, '雷').replace(/\s+(?=[(（])/g, '').replace(/\s+/g, ' ').trim();
  text = text.replace(/^古代(.+)的印章/u, '古代$1之印章');
  if (text === '古代火之印章(雷)' || text === '古代風之印章(雷)') return '古代雷之印章(雷)';
  return text;
}

(async () => {
  const data = await getJson('data/monsterdrop.json');
  const usageAll = await getJson('data/item-usage.json');

  // "/Images/cdn/maps/x.webp" or "Images/monsters/x.webp" → "drop/maps/x.webp"
  const images = new Map();
  const local = (src) => {
    if (!src) return '';
    const rel = src.replace(/^\/?Images\/(cdn\/)?/, '');
    images.set(rel, src.replace(/^\//, ''));
    return IMG_DIR + rel;
  };
  for (const c of data.countries) for (const m of c.maps) {
    m.image = local(m.image);
    for (const mo of m.monsters) mo.image = local(mo.image);
  }
  for (const it of Object.values(data.items)) it.image = local(it.image);

  const usage = {};
  for (const it of Object.values(data.items)) {
    const k = usageKey(it.name);
    if (!usageAll[k]) continue;
    usage[k] = {};
    for (const [field, v] of Object.entries(usageAll[k])) {
      usage[k][field] = Array.isArray(v) ? v.map((r) => ({ ...r, href: r.href ? SITE + r.href : '' })) : v;
    }
  }

  fs.writeFileSync(path.join(DIR, 'Drop-data.js'),
    'window.DROP_DATA=' + JSON.stringify(data) + ';\nwindow.DROP_USAGE=' + JSON.stringify(usage) + ';\n');

  const todo = [...images].filter(([rel]) => !fs.existsSync(path.join(DIR, IMG_DIR, rel)));
  const failed = [];
  for (let n = 0; n < todo.length; n += 24) {
    await Promise.all(todo.slice(n, n + 24).map(async ([rel, src]) => {
      const r = await fetch(SITE + src.split('/').map(encodeURIComponent).join('/')).catch(() => null);
      if (!r || !r.ok) { failed.push(src); return; }
      const out = path.join(DIR, IMG_DIR, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    }));
  }
  const monsters = data.countries.reduce((a, c) => a + c.maps.reduce((b, m) => b + m.monsters.length, 0), 0);
  console.log('countries:', data.countries.length, 'monsters:', monsters, 'items:', Object.keys(data.items).length,
    'usage:', Object.keys(usage).length, 'images:', images.size, 'fetched:', todo.length - failed.length, 'failed:', failed);
})();
