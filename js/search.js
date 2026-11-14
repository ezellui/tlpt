/* search.js — язык запросов: слова (все в одном положении), "фраза", слов*, ?, -слово. */
"use strict";
function parseQuery(q) {
  const terms = [];
  const rx = /(-?)"([^"]+)"|(-?)(\S+)/g; let m;
  while ((m = rx.exec(q))) {
    if (m[2]) terms.push({neg: !!m[1], phrase: true, v: fold(m[2]).trim()});
    else terms.push({neg: !!m[3], phrase: false, v: fold(m[4])});
  }
  return terms.filter(x => x.v);
}
function termRegex(term) {
  const B = '(?<![\\p{L}\\p{N}])', E = '(?![\\p{L}\\p{N}])';
  if (term.phrase) return B + term.v.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\W+') + E;
  const w = term.v.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\p{L}\\p{N}]*').replace(/\?/g, '[\\p{L}\\p{N}]');
  return B + w + E;
}
function compileQuery(q) {
  const terms = parseQuery(q);
  const pos = terms.filter(x => !x.neg), neg = terms.filter(x => x.neg);
  return {
    pos: pos.map(x => new RegExp(termRegex(x), 'u')), neg: neg.map(x => new RegExp(termRegex(x), 'u')),
    all: pos.length ? new RegExp(pos.map(termRegex).join('|'), 'gu') : null
  };
}
const PLAIN_CACHE = new Map();
function foldedPlain(text) {
  let v = PLAIN_CACHE.get(text);
  if (v === undefined) { v = fold(MD.plain(text)); PLAIN_CACHE.set(text, v); }
  return v;
}
function matches(cq, text) {
  const f = foldedPlain(text);
  return cq.pos.length && cq.pos.every(r => r.test(f)) && !cq.neg.some(r => r.test(f));
}
function countHits(cq, text) {
  if (!cq.all) return 0;
  const f = foldedPlain(text); cq.all.lastIndex = 0; let k = 0;
  while (cq.all.exec(f)) k++;
  return k;
}
function snippet(text, cq) {
  const plain = MD.plain(text); const [f, idx] = foldMap(plain);
  cq.all.lastIndex = 0; const m = cq.all.exec(f);
  if (!m) return esc(plain.slice(0, 200));
  const a = idx[m.index], b = idx[m.index + m[0].length];
  const s = Math.max(0, a - 90), e = Math.min(plain.length, b + 120);
  return (s ? '…' : '') + esc(plain.slice(s, a)) + '<mark>' + esc(plain.slice(a, b)) + '</mark>' + esc(plain.slice(b, e)) + (e < plain.length ? '…' : '');
}
