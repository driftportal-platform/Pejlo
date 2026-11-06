import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
test('merged layout preserves all functional panels and compact history controls',()=>{
 const html=readFileSync('dist/index.html','utf8');
 for(const id of ['profile-photo','keep-awake','last-contact','home-observation','alarm-list','snooze-status','admin-status','pairing-qr','show-distance-line','show-distance-rings','history-slider'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/<details class="history-more">/);assert.match(html,/class="playbar"/);
 for(const file of ['photo','wake-lock','snooze','admin','alarm-archive','pairing','profile-sheet','settings-tabs','hints','status-strip'])assert.ok(existsSync('dist/src/features/'+file+'.js'));
});
test('settings shortcut selects the visible area tab and status strip uses historical home wording',()=>{
 const app=readFileSync('dist/src/app.js','utf8');assert.match(app,/go\('indstillinger','omraade'\)/);
 assert.match(readFileSync('dist/src/features/profile-sheet.js','utf8'),/!profiles.length&&dialog.open\)dialog.close\(\)/);
 assert.match(readFileSync('dist/src/features/status-strip.js','utf8'),/read\('home-observation'\)/);
});
