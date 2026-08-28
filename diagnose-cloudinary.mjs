// One-off diagnostic: the `cloudinary` SDK's HTTP layer only parses response
// bodies for status codes [200, 400, 401, 404, 420, 500] — 403 isn't in that
// list, so it throws a generic "unexpected status code" message without ever
// reading Cloudinary's actual explanation. This bypasses the SDK's request
// layer and hits the REST API directly so we can see the real error body.
//
// Usage: node diagnose-cloudinary.mjs

import { readFileSync, existsSync } from 'node:fs';

function loadDotEnv() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const { v2: cloudinary } = await import('cloudinary');
const { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret } = cloudinary.config();

console.log('cloud_name:', cloudName);
console.log('api_key:', apiKey);
console.log('api_secret set:', Boolean(apiSecret), apiSecret ? `(${apiSecret.length} chars)` : '');

const timestamp = Math.round(Date.now() / 1000);
const folder = process.env.CLOUDINARY_FOLDER || 'bert48/party-2026';
const paramsToSign = { folder, timestamp };
const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

const form = new FormData();
form.append('timestamp', String(timestamp));
form.append('folder', folder);
form.append('api_key', apiKey);
form.append('signature', signature);
// 1x1 transparent PNG — no need for a real file for this test.
form.append(
  'file',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
);

const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
console.log('\nPOST', url);

const res = await fetch(url, { method: 'POST', body: form });
console.log('status:', res.status);
console.log('body:', await res.text());
