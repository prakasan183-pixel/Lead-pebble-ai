import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySearchWebsiteFinding,
  normalizeWebsiteUrl,
  verifyWebsiteUrl,
} from './websiteVerification.ts';

test('normalizes host casing, www, tracking query, and fragment', () => {
  const normalized = normalizeWebsiteUrl('WWW.Acme.test/products?ref=directory#top');
  assert.equal(normalized?.href, 'https://acme.test/products');
});

test('marks a responding site found only when page content verifies company identity', async () => {
  const fetcher: typeof fetch = async () => new Response(
    '<html><head><title>Acme Industrial</title></head><body>Welcome to Acme Industrial, official company information.</body></html>',
    { status: 200, headers: { 'content-type': 'text/html' } }
  );

  const result = await verifyWebsiteUrl('Acme Industrial', 'https://acme.test', fetcher);
  assert.equal(result.websiteStatus, 'active_website');
  assert.equal(result.websiteUrl, 'https://acme.test/');
  assert.equal(result.method, 'identity_verified');
});

test('follows redirects and uses final page URL after identity verification', async () => {
  const fetcher: typeof fetch = async () => {
    const response = new Response(
      '<html><title>Acme Works</title><body>Acme Works company website and product details.</body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } }
    );
    Object.defineProperty(response, 'url', { value: 'https://acmeworks.test/home' });
    return response;
  };

  const result = await verifyWebsiteUrl('Acme Works', 'http://old-acme.test', fetcher);
  assert.equal(result.websiteStatus, 'active_website');
  assert.equal(result.websiteUrl, 'https://acmeworks.test/home');
});

test('retries temporary request failure before verifying the site', async () => {
  let attempts = 0;
  const fetcher: typeof fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError('temporary connection failure');
    return new Response('<title>Acme Tools</title><body>Acme Tools official website with details.</body>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  };

  const result = await verifyWebsiteUrl('Acme Tools', 'https://acme-tools.test', fetcher);
  assert.equal(attempts, 2);
  assert.equal(result.websiteStatus, 'active_website');
});

test('treats bot protection and unrelated content as could not verify', async () => {
  const blocked: typeof fetch = async () => new Response('Please verify you are human', { status: 403 });
  const mismatch: typeof fetch = async () => new Response('<title>Unrelated store</title><body>Independent content</body>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });

  assert.equal((await verifyWebsiteUrl('Acme Pumps', 'https://acme.test', blocked)).websiteStatus, 'could_not_verify');
  assert.equal((await verifyWebsiteUrl('Acme Pumps', 'https://other.test', mismatch)).websiteStatus, 'could_not_verify');
});

test('does not call a JavaScript application shell a verified company website', async () => {
  const shell: typeof fetch = async () => new Response(
    '<html><head><title>Application</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>',
    { status: 200, headers: { 'content-type': 'text/html' } }
  );
  const result = await verifyWebsiteUrl('Acme Pumps', 'https://acme-pumps.test', shell);
  assert.equal(result.websiteStatus, 'could_not_verify');
  assert.match(result.notes, /JavaScript-rendered/);
});

test('requires cited search evidence before reporting no website found', () => {
  assert.equal(
    classifySearchWebsiteFinding('NO_OFFICIAL_SITE_FOUND', 'https://directory.example/acme').websiteStatus,
    'no_website_verified'
  );
  assert.equal(classifySearchWebsiteFinding('NO_OFFICIAL_SITE_FOUND').websiteStatus, 'could_not_verify');
  assert.equal(classifySearchWebsiteFinding('Search could not establish a site', 'https://directory.example/acme').websiteStatus, 'could_not_verify');
});
