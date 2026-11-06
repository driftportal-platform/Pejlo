import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const manifest=JSON.parse(readFileSync('dist/manifest.webmanifest','utf8'));
const png=path=>{const b=readFileSync(path);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');return {w:b.readUInt32BE(16),h:b.readUInt32BE(20)};};
test('manifest icons exist as real PNGs of the declared size, including a maskable one',()=>{
 const sizes=new Set(),purposes=new Set();
 for(const icon of manifest.icons){
  const file='dist/'+icon.src.replace(/^\.\//,'');assert.ok(existsSync(file),file);purposes.add(icon.purpose);
  if(icon.type==='image/png'){const {w,h}=png(file);assert.equal(icon.sizes,w+'x'+h);sizes.add(icon.sizes);}
 }
 assert.ok(sizes.has('192x192')&&sizes.has('512x512'));assert.ok(purposes.has('maskable')&&purposes.has('any'));
});
test('index links an apple-touch-icon of 180x180 and a PNG favicon',()=>{
 const html=readFileSync('dist/index.html','utf8');
 const apple=html.match(/rel="apple-touch-icon" href="\.\/([^"]+)"/)?.[1];assert.ok(apple);assert.deepEqual(png('dist/'+apple),{w:180,h:180});
 assert.match(html,/rel="icon" href="[^"]+favicon-64\.png"/);
});
test('headers: report-only CSP allows exactly the known origins; framing is denied',()=>{
 const headers=readFileSync('dist/_headers','utf8');
 const csp=headers.match(/Content-Security-Policy-Report-Only: (.+)/)?.[1];assert.ok(csp);
 assert.match(csp,/script-src 'self' https:\/\/www\.gstatic\.com(;|$)/);
 assert.ok(!/unsafe-eval|script-src[^;]*unsafe-inline|\*/.test(csp));
 assert.ok(!/apis\.google\.com|firebaseapp\.com/.test(csp),'Google popup/redirect code is no longer needed');
 assert.match(csp,/frame-src 'none'/);
 assert.match(csp,/object-src 'none'/);assert.match(csp,/base-uri 'none'/);
 assert.match(headers,/X-Frame-Options: DENY/);
 assert.ok(!/^\s*Content-Security-Policy:/m.test(headers),'enforcing header is a deliberate later step');
});
test('no inline event handlers (they would be blocked once the policy is enforced)',()=>{
 assert.ok(!/<[^>]+\son[a-z]+="/i.test(readFileSync('dist/index.html','utf8')));
});
test('index.html loads no scripts or styles from origins the policy does not allow',()=>{
 const html=readFileSync('dist/index.html','utf8');
 for(const m of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g))assert.ok(/^https:\/\/(www\.google\.com\/maps|www\.maptiler\.com|www\.openstreetmap\.org)/.test(m[1])||!/\.(js|css)(\?|$)/.test(m[1]),m[1]);
 assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html),'no inline scripts');
});
