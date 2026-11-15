/**
 * Tip Fair licence (6.11). The sidebar talks to Freemius itself, so the add-on needs no
 * external_request scope. This file keeps the result in Document Properties and decides Pro from it.
 * Only the uid, the key and the title "Tip Fair" ever leave the sheet.
 */

/** Freemius product, made at launch in the Facilo store (21741). */
var LICENCE = { productId: '44992', apiBase: 'https://api.freemius.com/v1', title: 'Tip Fair' };

function lic_() {
  var raw = PropertiesService.getDocumentProperties().getProperty('tfLicence');
  return raw ? JSON.parse(raw) : {};
}
function saveLic_(l) { PropertiesService.getDocumentProperties().setProperty('tfLicence', JSON.stringify(l)); }

/** What the rest of the add-on asks: is Pro on today? */
function licenceState_(today) {
  var l = lic_(), st;
  if (!l.key) return { pro: false, status: 'none', hasKey: false, productId: LICENCE.productId };
  if (l.status === 'ok') {
    var expired = l.expires && l.expires < today, left = Core.GRACE_DAYS - Core.daysBetween(l.lastGood || today, today);
    st = { pro: !expired && (l.lastFail ? left > 0 : true), status: expired ? 'expired' : 'ok', expires: l.expires || null, left: Math.max(0, left) };
  } else st = { pro: false, status: l.status || 'wrong', expires: l.expires || null };
  st.hasKey = true;
  st.keyEnd = l.key.slice(-4);
  st.needsCheck = l.status === 'ok' && (!l.lastCheck || l.lastCheck < today);
  st.productId = LICENCE.productId;
  return st;
}

/** What the sidebar sends to Freemius. */
function licenceRequest(key) {
  var l = lic_();
  return { ok: !!LICENCE.productId, uid: Core.uid(ss_().getId()), key: String(key || l.key || '').trim(), installId: l.installId || '',
    productId: LICENCE.productId, apiBase: LICENCE.apiBase, title: LICENCE.title };
}

/**
 * Stores what Freemius said. result.status: 'ok' | 'wrong' | 'used' | 'expired' | 'cancelled' | 'offline'.
 * Offline keeps Pro for 14 days from the last good check (Core.GRACE_DAYS).
 */
function recordLicence(result) {
  var l = lic_(), today = today_();
  if (result.status === 'ok') {
    l = { key: result.key || l.key, installId: String(result.installId || l.installId || ''), status: 'ok', expires: result.expires ? String(result.expires).slice(0, 10) : null, lastGood: today, lastCheck: today };
  } else if (result.status === 'offline') {
    if (l.status === 'ok') { l.lastFail = today; l.lastCheck = today; }
  } else if (result.status === 'expired' || result.status === 'cancelled') {
    l.status = result.status; l.lastCheck = today;
    if (result.expires) l.expires = String(result.expires).slice(0, 10);
  } else {
    // A wrong key typed over a working one doesn't switch Pro off.
    if (l.key && l.status === 'ok' && result.key && result.key !== l.key) return { pro: licenceState_(today).pro, status: result.status, hasKey: true };
    l = { key: result.key || l.key, installId: l.installId || '', status: result.status || 'wrong', expires: l.expires || null, lastCheck: today };
  }
  saveLic_(l);
  return licenceState_(today);
}
