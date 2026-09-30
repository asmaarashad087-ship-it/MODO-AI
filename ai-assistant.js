/*!
 * ai-assistant.js  —  MODO AI  (المساعد الذكي + مساعد الشيتات + "اشرحلي" في بنك الأسئلة)
 * -----------------------------------------------------------------------------------------
 * ملف مستقل قابل للنشر على GitHub Pages بجانب index.html.
 * كل طالب بيدخل مفتاح Anthropic API الخاص بيه مرة واحدة (بيتخزن في متصفحه بس)،
 * فالاستهلاك بيتحسب على حسابه هو، مش على حسابك.
 *
 * لو الصفحة اتفتحت جوه claude.ai (اللي فيها claude.use جاهز) الملف ده مش بيعمل حاجة.
 *
 * إعدادات اختيارية (حطها في index.html قبل تحميل الملف ده):
 *   window.MODO_AI = { proxy: "https://your-worker.workers.dev", model_complex: "claude-sonnet-5-5" };
 *   - proxy : لو عاوزة تستخدمي سيرفر وسيط بمفتاحك انتِ (الطلاب مش هيدخلوا مفتاح).
 */
(function () {
  'use strict';
  if (window.claude && typeof window.claude.use === 'function') return; // شغال جوه claude.ai

  var CFG = Object.assign({
    model_complex: 'claude-sonnet-5-5',          // الشرح، حل الشيت، شات المساعد
    model_fast: 'claude-haiku-4-5-20251001',     // أرخص وأسرع
    max_tokens: 4000,
    proxy: ''
  }, window.MODO_AI || {});

  var API = 'https://api.anthropic.com/v1/messages';
  var STORE = 'modo_ai_key';

  function lsGet() { try { return localStorage.getItem(STORE) || ''; } catch (e) { return ''; } }
  function lsSet(v) { try { v ? localStorage.setItem(STORE, v) : localStorage.removeItem(STORE); } catch (e) {} }
  function isAr() { try { return typeof lang !== 'undefined' ? lang === 'ar' : true; } catch (e) { return true; } }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }

  /* ---------- نافذة إدخال المفتاح ---------- */
  var pending = null;
  function askKey() {
    if (pending) return pending;
    pending = new Promise(function (resolve, reject) {
      var B = isAr();
      var T = B ? {
        h: 'فعّل المساعد الذكي', p: 'المساعد بيشتغل بمفتاح Anthropic API الخاص بيك، والاستهلاك بيتحسب على حسابك انت. المفتاح بيتحفظ على جهازك بس ومش بيتبعت لأي حد غير Anthropic.',
        s: 'إزاي تجيب المفتاح؟', s1: 'ادخل على console.anthropic.com وسجّل بحسابك', s2: 'من Settings ← API Keys اعمل Create Key', s3: 'اشحن رصيد صغير من Billing، وانسخ المفتاح والصقه هنا',
        save: 'حفظ ومتابعة', cancel: 'إلغاء', bad: 'المفتاح لازم يبدأ بـ sk-ant-'
      } : {
        h: 'Enable the AI assistant', p: 'The assistant runs on your own Anthropic API key, so usage is billed to your account. The key is stored on this device only and is sent only to Anthropic.',
        s: 'How to get a key', s1: 'Go to console.anthropic.com and sign in', s2: 'Settings → API Keys → Create Key', s3: 'Add a small credit under Billing, then copy the key and paste it here',
        save: 'Save & continue', cancel: 'Cancel', bad: 'The key must start with sk-ant-'
      };
      var ov = document.createElement('div');
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(5,12,30,.65);display:flex;align-items:center;justify-content:center;padding:16px';
      ov.innerHTML =
        '<div dir="' + (B ? 'rtl' : 'ltr') + '" style="background:var(--card,#fff);color:var(--ink,#0d2247);border-radius:16px;max-width:460px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.4);font-family:inherit;line-height:1.7">' +
        '<h3 style="margin:0 0 8px;font-size:1.2rem">🔑 ' + T.h + '</h3>' +
        '<p style="margin:0 0 10px;font-size:.92rem;opacity:.85">' + T.p + '</p>' +
        '<details style="margin:0 0 12px;font-size:.88rem"><summary style="cursor:pointer;font-weight:700">' + T.s + '</summary>' +
        '<ol style="margin:6px 0 0;padding-inline-start:20px"><li>' + T.s1 + '</li><li>' + T.s2 + '</li><li>' + T.s3 + '</li></ol></details>' +
        '<input id="modoKeyIn" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-..." dir="ltr" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#dbe5f3);background:transparent;color:inherit;font:inherit">' +
        '<div id="modoKeyErr" style="color:var(--bad,#c2372f);font-size:.85rem;min-height:1.3em;margin-top:4px"></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">' +
        '<button id="modoKeyNo" type="button" style="padding:8px 16px;border-radius:99px;border:1px solid var(--line,#dbe5f3);background:transparent">' + T.cancel + '</button>' +
        '<button id="modoKeyOk" type="button" style="padding:8px 18px;border-radius:99px;border:0;background:var(--teal,#1f7ae0);color:#fff;font-weight:700">' + T.save + '</button></div></div>';
      document.body.appendChild(ov);
      var inp = ov.querySelector('#modoKeyIn'), er = ov.querySelector('#modoKeyErr');
      function done(fn, v) { document.removeEventListener('keydown', onKey); ov.remove(); pending = null; fn(v); }
      function ok() {
        var v = inp.value.trim();
        if (v.indexOf('sk-ant-') !== 0) { er.textContent = T.bad; return; }
        lsSet(v); done(resolve, v);
      }
      function onKey(e) { if (e.key === 'Escape') done(reject, err('cancelled')); if (e.key === 'Enter') ok(); }
      ov.querySelector('#modoKeyOk').onclick = ok;
      ov.querySelector('#modoKeyNo').onclick = function () { done(reject, err('cancelled')); };
      document.addEventListener('keydown', onKey);
      setTimeout(function () { inp.focus(); }, 50);
    });
    return pending;
  }

  async function ensureKey() {
    if (CFG.proxy) return '';
    return lsGet() || askKey();
  }

  /* ---------- تجهيز الرسائل ---------- */
  function normalize(input) {
    var arr = typeof input === 'string' ? [{ role: 'user', content: input }] : (input || []);
    var out = [];
    arr.forEach(function (m) {
      if (!m || !m.content) return;
      var role = m.role === 'assistant' ? 'assistant' : 'user', c = String(m.content);
      if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n\n' + c;
      else out.push({ role: role, content: c });
    });
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  /* ---------- الاستدعاء (Streaming) ---------- */
  async function sample(input, opts) {
    opts = opts || {};
    var key = await ensureKey();
    var body = {
      model: opts.modelTier === 'complex' ? CFG.model_complex : CFG.model_fast,
      max_tokens: CFG.max_tokens,
      messages: normalize(input),
      stream: true
    };
    var headers = { 'content-type': 'application/json' };
    if (!CFG.proxy) {
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    var res;
    try {
      res = await fetch(CFG.proxy || API, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: opts.signal });
    } catch (e) { throw err('net', e && e.message); }

    if (!res.ok) {
      var m = '';
      try { var j = await res.json(); m = (j && j.error && j.error.message) || ''; } catch (e) {}
      if (res.status === 401) { lsSet(''); throw err('invalid_key', m); }
      if (res.status === 402 || /credit balance/i.test(m)) throw err('no_credit', m);
      if (res.status === 429) throw err('rate_limited', m);
      if (res.status === 403) throw err('forbidden', m);
      if (res.status >= 500) throw err('overloaded', m);
      throw err('http_' + res.status, m);
    }

    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '', text = '';
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var parts = buf.split('\n\n'); buf = parts.pop();
      for (var i = 0; i < parts.length; i++) {
        var line = parts[i].split('\n').filter(function (l) { return l.indexOf('data:') === 0; })[0];
        if (!line) continue;
        var ev; try { ev = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
          text += ev.delta.text;
          if (opts.onText) opts.onText({ text: text });
        } else if (ev.type === 'error') {
          throw err(ev.error && ev.error.type === 'overloaded_error' ? 'overloaded' : 'api_error', ev.error && ev.error.message);
        }
      }
    }
    return { text: text };
  }

  /* ---------- نفس واجهة claude.use("sample") اللي index.html بيستخدمها ---------- */
  window.claude = {
    use: async function (name) { return name === 'sample' ? sample : null; }
  };
  window.MODO_AI_KEY = {
    open: function () { return askKey().catch(function () {}); },
    clear: function () { lsSet(''); },
    has: function () { return !!lsGet(); }
  };
})();
