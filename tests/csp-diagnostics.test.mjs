import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installCspDiagnostics} from '../apps/web/src/features/csp-diagnostics.js';
test('CSP reports stay in the console, are deduplicated and omit URL paths and secrets',()=>{
 let listener;const logs=[];installCspDiagnostics({addEventListener:(name,fn)=>{assert.equal(name,'securitypolicyviolation');listener=fn;}},{warn:(...v)=>logs.push(v)});
 const event={blockedURI:'https://apis.google.com/_/scs/abc-static/script.js?secret=never-show',violatedDirective:'script-src-elem',disposition:'report'};
 listener(event);listener(event);assert.equal(logs.length,1);assert.equal(logs[0][3],'https://apis.google.com');assert.equal(JSON.stringify(logs).includes('never-show'),false);
 assert.doesNotMatch(readFileSync('apps/web/src/features/csp-diagnostics.js','utf8'),/toast\(/);
});
test('alarm settings button has an unambiguous label and CSP stays report-only',()=>{
 const html=readFileSync('dist/index.html','utf8');assert.match(html,/>Gem alarmindstillinger<\/button>/);assert.doesNotMatch(html,/Gem mine beskeder/);
 const headers=readFileSync('dist/_headers','utf8');assert.match(headers,/Content-Security-Policy-Report-Only:/);assert.doesNotMatch(headers,/^\s*Content-Security-Policy:/m);
});
