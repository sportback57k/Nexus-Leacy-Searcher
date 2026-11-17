'use strict';
const SITE_URL = 'https://nexussearcher.vercel.app/accueil/';
const SITE_ORIGIN = new URL(SITE_URL).origin;
function isSiteURL(value) {
  try { const u = new URL(value); return u.origin === SITE_ORIGIN && !u.username && !u.password; }
  catch { return false; }
}
function isExternalURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
}
module.exports = { SITE_URL, SITE_ORIGIN, isSiteURL, isExternalURL };
