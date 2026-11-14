/* data.js — загрузка файлов данных. Страница, открытая с диска, может подключать скрипты,
   но не читать файлы, поэтому каждый файл данных — скрипт вида TLP.put('ключ', значение)
   (как в читалке HWPh). Манифест и дерево подключены в index.html; тексты редакций
   (data/ed/<id>.js) подгружаются, когда редакция понадобилась. */
"use strict";
window.TLP = (function () {
  const DATA = new Map(), WAIT = new Map();
  function put(key, value) {
    DATA.set(key, value);
    const w = WAIT.get(key);
    if (w) { w.forEach(f => f.ok(value)); WAIT.delete(key); }
  }
  function get(key) { return DATA.get(key); }
  function load(key, file) {
    if (DATA.has(key)) return Promise.resolve(DATA.get(key));
    return new Promise((ok, bad) => {
      if (WAIT.has(key)) { WAIT.get(key).push({ok, bad}); return; }
      WAIT.set(key, [{ok, bad}]);
      const s = document.createElement('script');
      s.src = 'data/' + (file || key + '.js');
      s.onerror = () => { const w = WAIT.get(key) || []; WAIT.delete(key); w.forEach(f => f.bad(new Error('no file: data/' + (file || key + '.js')))); };
      document.head.appendChild(s);
    });
  }
  return {put, get, load};
})();
