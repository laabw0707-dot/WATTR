/* تخزين دائم + نسخ localStorage إلى IndexedDB واستعادتها إن مُسحت */
(function () {
  'use strict';
  var DBN = 'watar-ls-backup', ST = 'kv', KEY = 'snapshot', FLAG = 'watar-restored';

  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {}

  function open() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet() {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var q = db.transaction(ST, 'readonly').objectStore(ST).get(KEY);
        q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
      });
    });
  }
  function idbPut(v) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, KEY);
        t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); };
      });
    });
  }
  function snapshot() {
    var o = {};
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o[k] = localStorage.getItem(k); } } catch (e) { return null; }
    return o;
  }
  var timer = 0;
  function backup() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var s = snapshot();
      if (s && Object.keys(s).length) idbPut(s).catch(function () {});
    }, 600);
  }

  // اعتراض الكتابة لعمل نسخة تلقائية
  try {
    var P = Storage.prototype, set = P.setItem, rem = P.removeItem;
    P.setItem = function () { var r = set.apply(this, arguments); if (this === localStorage) backup(); return r; };
    P.removeItem = function () { var r = rem.apply(this, arguments); if (this === localStorage) backup(); return r; };
  } catch (e) {}

  addEventListener('pagehide', function () { var s = snapshot(); if (s && Object.keys(s).length) idbPut(s).catch(function () {}); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') backup(); });

  // الاستعادة: إن كان localStorage فارغًا والنسخة موجودة
  var empty = false;
  try { empty = localStorage.length === 0; } catch (e) {}
  if (empty && !sessionStorage.getItem(FLAG)) {
    idbGet().then(function (s) {
      if (!s || !Object.keys(s).length) return;
      Object.keys(s).forEach(function (k) { try { localStorage.setItem(k, s[k]); } catch (e) {} });
      try { sessionStorage.setItem(FLAG, '1'); } catch (e) {}
      location.reload(); // ليقرأ التطبيق البيانات المستعادة
    }).catch(function () {});
  } else {
    backup();
  }
})();
