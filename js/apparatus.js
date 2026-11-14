/* apparatus.js — аппарат изданий: статьи и введения, указатель 1961 г., литература 2005 г.,
   а также сводный список примечаний каждой редакции со ссылками на положения.
   Адрес: #/app — список; #/app/<редакция>/<раздел> — раздел (раздел notes — примечания редакции). */
"use strict";

const NUM_SET = new Set(NUMS);
// номера положений в готовом HTML → ссылки (только вне тегов и вне уже существующих ссылок)
function linkNums(html, loose) {
  let inA = 0;
  return html.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, txt) => {
    if (tag) { if (/^<a[\s>]/.test(tag)) inA++; else if (/^<\/a>/.test(tag)) inA = Math.max(0, inA - 1); return tag; }
    if (inA) return txt;
    const rx = loose ? /(^|[\s,(\[;])([1-7](?:\.\d+)?)(?=$|[\s,;)\]]|\.(?!\d))/g : /(^|[\s,(\[;—–-])([1-7]\.\d+)(?=$|[\s,;)\]:]|\.(?!\d))/g;
    return txt.replace(rx, (m2, pre, n) => NUM_SET.has(n) ? `${pre}<a class="pref" href="#/p/${n}">${n}</a>` : m2);
  });
}

function appSections(ed) {
  const secs = (D.app[ed] || []).map(s => ({id: s.id, title: s.title}));
  if (Object.keys(D.notes[ed] || {}).length) secs.push({id: 'notes', title: t('app.notes')});
  return secs;
}

// где стоит сноска: положения, предисловие и т. п.
function noteUses(ed) {
  const uses = {};
  const scan = (txt, where) => { for (const m of (txt || '').matchAll(/\[\^([^\]]+)\]/g)) (uses[m[1]] = uses[m[1]] || []).push(where); };
  NUMS.forEach(n => scan(D.props[n].text[ed], n));
  const f = D.front[ed] || {};
  ['dedication', 'motto', 'preface_title'].forEach(k => scan(f[k], 'front'));
  (f.preface || []).forEach(x => scan(x, 'front'));
  return uses;
}

async function showApp(ed, sid) {
  CUR = null; markNav();
  await ensure(EDS);
  let h = `<div class="page app"><div class="applist">`;
  EDS.forEach(e => {
    const secs = appSections(e);
    h += `<div class="ae"><div class="aeh">${esc(D.editions[e].short)}</div>`;
    h += secs.length ? secs.map(s => `<a href="#/app/${e}/${s.id}" class="${e === ed && s.id === sid ? 'on' : ''}">${MD.inline(s.title, {})}</a>`).join('')
      : `<span class="miss">${t('app.none')}</span>`;
    h += '</div>';
  });
  h += `</div><div class="appbody" lang="${ed ? D.editions[ed].lang : LANG}">`;
  if (!ed || !sid) {
    h += `<h2>${t('app.title')}</h2><p class="help">${t('app.lead')}</p>`;
  } else if (sid === 'notes') {
    const notes = D.notes[ed] || {}, uses = noteUses(ed);
    const keys = Object.keys(notes).sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0) || a.localeCompare(b));
    h += `<h2>${t('app.notes')} — ${esc(D.editions[ed].short)}</h2><dl class="notes">`;
    keys.forEach(k => {
      const where = (uses[k] || []).map(w => w === 'front' ? `<a href="#/front">${t('nav.front')}</a>` : `<a class="pref" href="#/p/${w}">${w}</a>`).join(', ');
      h += `<dt>${esc(k.replace(/^p\d+$/, '*'))}</dt><dd>${linkNums(MD.render(notes[k], {fig: figFor(ed), fn: fnFor(ed)}))}${where ? `<div class="uses">${t('app.used')} ${where}</div>` : ''}</dd>`;
    });
    h += '</dl>';
  } else {
    const s = (D.app[ed] || []).find(x => x.id === sid);
    if (!s) h += `<p class="miss">${t('app.none')}</p>`;
    else {
      h += `<h2>${MD.inline(s.title, {})}</h2>`;
      const fn = lab => `<sup class="fn"><a data-ed="${ed}" data-sec="${esc(s.id)}" data-fn="${esc(lab)}">${esc(lab.replace(/^\w\d+-(\d+)$/, (m, k) => '*'.repeat(+k)))}</a></sup>`;
      const opt = {fig: figFor(ed), fn};
      if (s.kind === 'text') {
        h += linkNums(MD.render(s.text, opt));
        const nk = Object.keys(s.notes);
        if (nk.length) h += `<dl class="notes small">${nk.map(k => `<dt>${'*'.repeat(+k.split('-')[1] || 1)}</dt><dd>${linkNums(MD.render(s.notes[k], opt))}</dd>`).join('')}</dl>`;
      } else if (s.kind === 'index') {
        h += `<p class="help">${esc(s.lead)}</p><div class="index">`;
        let letter = '';
        s.entries.forEach(e => {
          const L = (e.head.replace(/^[^A-Za-z]+/, '')[0] || '').toUpperCase();
          if (L && L !== letter) { letter = L; h += `<div class="il">${L}</div>`; }
          h += `<div class="ie"><div class="ih">${linkNums(MD.inline(e.head, opt), true)}</div>` +
            e.subs.map(x => `<div class="is${x.startsWith('\t') ? ' is2' : ''}">${linkNums(MD.inline(x.trim(), opt), true)}</div>`).join('') + '</div>';
        });
        h += `</div><p class="help">* ${esc(s.credit)}</p>`;
      } else if (s.kind === 'biblio') {
        h += `<h3>${t('app.abbrev')}</h3>` + s.abbrev.map(x => `<p class="bib">${MD.inline(x, opt)}</p>`).join('');
        h += `<h3>${t('app.works')}</h3>` + s.items.map(x => `<p class="bib">${MD.inline(x, opt)}</p>`).join('');
      }
    }
  }
  view.innerHTML = h + '</div></div>';
  view.scrollTop = 0;
}
