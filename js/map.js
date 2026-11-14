/* map.js — карта «Трактата»: радиальное дерево, площадь круга ~ число потомков;
   по желанию — ссылки между положениями (номера в текстах и комментариях) дугами. */
"use strict";
let MAP_REFS = store.get('maprefs', '1') === '1';
let MAP_MODE = store.get('mapmode', 'tree');
const modeBar = () => `<span class="seg"><a href="#/map?mode=tree" class="${MAP_MODE === 'tree' ? 'on' : ''}">${t('map.mode_tree')}</a><a href="#/map?mode=ring" class="${MAP_MODE === 'ring' ? 'on' : ''}">${t('map.mode_ring')}</a></span>`;

function showMap(at, mode) {
  if (mode === 'tree' || mode === 'ring') { MAP_MODE = mode; store.set('mapmode', mode); }
  if (at) CUR = at;
  markNav();
  if (MAP_MODE === 'tree') return showMapTree();
  const roots = NUMS.filter(n => !D.props[n].parent);
  const W = 1200, H = 1200, cx = W / 2, cy = H / 2;
  const leaves = {};
  NUMS.slice().reverse().forEach(n => { const k = CHILDREN(n); leaves[n] = k.length ? k.reduce((s, c) => s + leaves[c], 0) : 1; });
  roots.forEach(r => { leaves[r] = Math.max(leaves[r], 24); });   // корням — место для подписи
  const total = roots.reduce((s, r) => s + leaves[r], 0);
  const pos = {};
  const place = (n, a0, depth) => {
    const span = leaves[n] / total * Math.PI * 2;
    const a = a0 + span / 2, r = 70 + depth * 92;
    pos[n] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    let s = a0; CHILDREN(n).forEach(c => { place(c, s, depth + 1); s += leaves[c] / total * Math.PI * 2; });
  };
  let acc = 0;
  roots.forEach(r => { place(r, acc, 0); acc += leaves[r] / total * Math.PI * 2; });
  let lines = '', refs = '', dots = '', labels = '';
  const f = v => v.toFixed(1);
  NUMS.forEach(n => {
    const p = D.props[n].parent, [x, y] = pos[n];
    if (p) lines += `<line x1="${f(pos[p][0])}" y1="${f(pos[p][1])}" x2="${f(x)}" y2="${f(y)}" stroke="var(--rule)" stroke-width="1"/>`;
    if (MAP_REFS) (D.props[n].refs || []).forEach(r => {
      const [x2, y2] = pos[r];
      // дуга через точку, сдвинутую к центру — чтобы ссылки не сливались с ветвями дерева
      const mx = (x + x2) / 2, my = (y + y2) / 2, qx = mx + (cx - mx) * .45, qy = my + (cy - my) * .45;
      refs += `<path class="ref" d="M${f(x)},${f(y)} Q${f(qx)},${f(qy)} ${f(x2)},${f(y2)}"><title>${n} → ${r}</title></path>`;
    });
    const rad = 2.2 + Math.sqrt(DESC[n]) * 2.1;
    dots += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" fill="${n === CUR ? 'var(--mark-cur)' : 'var(--brass)'}" ${n === CUR ? 'class="hl"' : ''} fill-opacity="${D.props[n].parent ? .75 : 1}" data-n="${n}"><title>${n} ${esc(firstLine(n, lead()))}</title></circle>`;
    if (!D.props[n].parent || DESC[n] >= 8 || n === CUR) labels += `<text x="${f(x + rad + 2)}" y="${f(y + 4)}" font-size="${D.props[n].parent ? 11 : 16}" fill="var(--ink)">${n}</text>`;
  });
  const nrefs = NUMS.reduce((s, n) => s + (D.props[n].refs || []).length, 0);
  view.innerHTML = `<div class="page map"><h2>${t('map.title')}</h2><div class="tree-note">${t('map.note')}</div>
    <div class="ctl">${modeBar()} <label><input type="checkbox" id="maprefs" ${MAP_REFS ? 'checked' : ''}> ${esc(t('map.refs', {n: nrefs}))}</label></div>
    <svg viewBox="0 0 ${W} ${H}">${lines}${refs}${dots}${labels}</svg></div>`;
  view.querySelector('svg').addEventListener('click', e => { const n = e.target.dataset && e.target.dataset.n; if (n) location.hash = '#/p/' + n; });
  $('#maprefs').onchange = e => { MAP_REFS = e.target.checked; store.set('maprefs', MAP_REFS ? '1' : '0'); showMap(at); };
  view.scrollTop = 0;
}

/* Дерево до конца — по образцу «Логического дерева „Трактата“» издания 2023 г.:
   столбец = число знаков после точки (2 → 2.01 через ноль уходит на два столбца),
   линия: сплошная — обычное уточнение, штриховая — через один ноль, пунктир — через два. */
function showMapTree() {
  const COL = 112, ROW = 17, X0 = 34, Y0 = 18;
  const digits = n => (n.split('.')[1] || '').length;
  const y = {}; let row = 0;
  const place = n => {
    const k = CHILDREN(n);
    if (!k.length) { y[n] = Y0 + row++ * ROW; return; }
    k.forEach(place);
    y[n] = (y[k[0]] + y[k[k.length - 1]]) / 2;
  };
  const roots = NUMS.filter(n => !D.props[n].parent);
  roots.forEach((r, i) => { place(r); row += i < roots.length - 1 ? 1 : 0; });
  const x = n => X0 + digits(n) * COL;
  const wch = (n, root) => n.length * (root ? 10 : 6.6);
  const f = v => v.toFixed(1);
  let lines = '', labels = '';
  NUMS.forEach(n => {
    const p = D.props[n].parent, root = !p;
    if (p) {
      const z = digits(n) - digits(p) - 1;                 // сколько нулей пропущено
      const x1 = x(p) + wch(p, !D.props[p].parent) + 5, fx = x1 + 14, x2 = x(n) - 5;
      lines += `<path class="l${Math.min(z, 2)}" d="M${f(x1)} ${f(y[p])}H${f(fx)}L${f(Math.max(fx, x2 - 16))} ${f(y[n])}H${f(x2)}" fill="none"/>`;
    }
    labels += `<text x="${f(x(n))}" y="${f(y[n] + 4)}" font-size="${root ? 16 : 11.5}" data-n="${n}" class="${n === CUR ? 'cur' : ''}"><title>${n} ${esc(firstLine(n, lead()))}</title>${n}</text>`;
  });
  const top = y[roots[0]], bot = y[roots[roots.length - 1]];
  const spine = `<path class="l0" d="M14 ${f(top)}V${f(bot)}${roots.map(r => `M14 ${f(y[r])}H${X0 - 4}`).join('')}" fill="none"/>`;
  const W = X0 + 6 * COL + 60, H = Y0 + row * ROW + 10;
  view.innerHTML = `<div class="page map"><h2>${t('map.title')}</h2><div class="tree-note">${t('map.tree_note')}</div>
    <div class="ctl">${modeBar()}</div>
    <div class="maptree"><svg width="${W}" height="${f(H)}" viewBox="0 0 ${W} ${f(H)}" font-family="var(--sans)">${spine}${lines}${labels}</svg></div></div>`;
  const box = view.querySelector('.maptree');
  box.addEventListener('click', e => { const n = e.target.closest('text') && e.target.closest('text').dataset.n; if (n) location.hash = '#/p/' + n; });
  view.scrollTop = 0;
  if (CUR && y[CUR] !== undefined) box.scrollTop = Math.max(0, y[CUR] - box.clientHeight / 2);
}
