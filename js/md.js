/* md.js — маленький Markdown-рендер для текстов «Трактата» (читалка и листы вычитки).
   Понимает ровно то, что пишут сборщики: абзацы, *курсив*, **полужирный**, ```блок```,
   таблицы |…|, $формула$ и $$формула$$ (KaTeX, если он загружен), ![](fig:имя),
   сноски [^метка], <sup>/<sub>, цитату «> …». Всё прочее экранируется. */
"use strict";
(function (root) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function math(tex, display) {
    if (root.katex) {
      try { return root.katex.renderToString(tex, {displayMode: display, throwOnError: false, output: 'html'}); }
      catch (e) { /* ниже — запасной вид */ }
    }
    return `<code class="tex">${esc(tex)}</code>`;
  }

  // строчная разметка: формулы и сноски вынимаются до экранирования
  function inline(s, opt) {
    const keep = [];
    const put = h => '\u0000' + (keep.push(h) - 1) + '\u0000';
    s = s.replace(/\$\$([^$]+)\$\$/g, (m, t) => put(math(t, true)));
    s = s.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (m, a, t) => a + put(math(t, false)));
    s = s.replace(/!\[([^\]]*)\]\(fig:([^)]+)\)/g, (m, alt, name) => put(opt.fig ? opt.fig(name, alt) : `[${esc(name)}]`));
    s = s.replace(/\[\^([^\]]+)\]/g, (m, lab) => put(opt.fn ? opt.fn(lab) : `<sup>[${esc(lab)}]</sup>`));
    s = s.replace(/<(\/?)(sup|sub)>/g, (m, c, t) => put(`<${c}${t}>`));
    s = esc(s);
    s = s.replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[^\w*])\*([^*\n]+?)\*(?![\w*])/g, '$1<i>$2</i>');
    s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
    return s;
  }

  function table(lines, opt) {
    const cells = l => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
    const head = cells(lines[0]);
    const body = lines.slice(2).map(cells);
    const emptyHead = head.every(c => !c);
    let h = '<div class="tbl"><table>';
    if (!emptyHead) h += '<thead><tr>' + head.map(c => `<th>${inline(c, opt)}</th>`).join('') + '</tr></thead>';
    h += '<tbody>' + body.map(r => '<tr>' + r.map(c => `<td>${inline(c, opt)}</td>`).join('') + '</tr>').join('') + '</tbody>';
    return h + '</table></div>';
  }

  function render(md, opt) {
    opt = opt || {};
    if (!md) return '';
    const out = [];
    const blocks = [];
    // блоки ``` могут содержать пустые строки — режем аккуратно
    const lines = md.replace(/\r/g, '').split('\n');
    let cur = [], inPre = false;
    for (const ln of lines) {
      if (ln.trim().startsWith('```')) {
        if (inPre) { cur.push(ln); blocks.push(cur.join('\n')); cur = []; inPre = false; continue; }
        if (cur.length) { blocks.push(cur.join('\n')); cur = []; }
        inPre = true; cur.push(ln); continue;
      }
      if (inPre) { cur.push(ln); continue; }
      if (!ln.trim()) { if (cur.length) { blocks.push(cur.join('\n')); cur = []; } continue; }
      cur.push(ln);
    }
    if (cur.length) blocks.push(cur.join('\n'));
    for (const b of blocks) {
      const t = b.trim();
      if (t.startsWith('```')) {
        const body = t.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').split('\n');
        const ind = Math.min(...body.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
        out.push('<pre class="scheme">' + esc(body.map(l => l.slice(isFinite(ind) ? ind : 0)).join('\n')) + '</pre>');
      } else if (/^\$\$[\s\S]+\$\$$/.test(t) && t.indexOf('$$', 2) === t.length - 2) {
        out.push('<div class="md-display">' + math(t.slice(2, -2), true) + '</div>');
      } else if (/^\|/.test(t) && t.split('\n').length >= 2 && /^\|?\s*:?-/.test(t.split('\n')[1])) {
        out.push(table(t.split('\n'), opt));
      } else if (/^!\[[^\]]*\]\(fig:[^)]+\)$/.test(t)) {
        out.push('<figure>' + inline(t, opt) + '</figure>');
      } else if (/^>/.test(t)) {
        out.push('<blockquote>' + render(t.replace(/^> ?/gm, ''), opt) + '</blockquote>');
      } else {
        out.push('<p>' + inline(t, opt).replace(/ {2}\n/g, '<br>').replace(/\n/g, ' ') + '</p>');
      }
    }
    return out.join('\n');
  }

  function plain(md) {
    return (md || '').replace(/```[\s\S]*?```/g, ' ').replace(/\$\$?[^$]*\$\$?/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[\^[^\]]+\]/g, '')
      .replace(/<\/?(sup|sub)>/g, '').replace(/[*|]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  root.TLPmd = {render, inline, plain, esc};
})(typeof window !== 'undefined' ? window : globalThis);
