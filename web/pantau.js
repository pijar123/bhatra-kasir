// Catat error JavaScript ke database (log_client_error), maks 5 per halaman, tanpa data pribadi.
(function () {
  let n = 0; const seen = new Set();
  function kirim(msg, src) {
    msg = String(msg || '').slice(0, 500); if (!msg || seen.has(msg) || n >= 5) return; seen.add(msg); n++;
    if (/ResizeObserver|Script error\.?$|extension:\/\/|chrome-extension/i.test(msg + (src || ''))) return;
    let shop = null; try { shop = (typeof SET !== 'undefined' && SET && SET.id) || null; } catch (e) {}
    try {
      fetch(CONFIG.SUPABASE_URL + '/rest/v1/rpc/log_client_error', { method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY },
        body: JSON.stringify({ p_shop: shop, p_page: location.pathname, p_msg: msg, p_src: src || null, p_ua: navigator.userAgent.slice(0, 200) }) }).catch(() => {});
    } catch (e) {}
  }
  addEventListener('error', e => { if (e.message) kirim(e.message, (e.filename || '').split('/').pop() + ':' + e.lineno); });
  addEventListener('unhandledrejection', e => { const r = e.reason; kirim(r && (r.message || r.toString()), r && r.stack ? String(r.stack).split('\n')[1]?.trim() : null); });
})();
