'use strict';
const assert = require('node:assert/strict');
const { SITE_URL, isSiteURL, isExternalURL } = require('./policy.cjs');
assert.equal(isSiteURL(SITE_URL), true);
assert.equal(isSiteURL('https://nexussearcher.vercel.app/connexion/?next=home'), true);
for (const url of [
  'http://nexussearcher.vercel.app/', 'https://nexussearcher.vercel.app.evil.example/',
  'https://evil.example/nexussearcher.vercel.app', 'https://user:password@nexussearcher.vercel.app/',
  'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,test', 'invalid'
]) assert.equal(isSiteURL(url), false, url);
assert.equal(isExternalURL('https://discord.com/'), true);
for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'https://user:password@example.com']) {
  assert.equal(isExternalURL(url), false, url);
}
console.log('PASS: navigation limitée à Nexus, protocoles externes et URLs avec identifiants bloqués');
