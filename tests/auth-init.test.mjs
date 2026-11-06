import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAuth} from '../apps/web/src/features/auth.js';
const sdk=(over={})=>({indexedDBLocalPersistence:'idb',browserLocalPersistence:'local',browserSessionPersistence:'session',getAuth:app=>({via:'getAuth',app}),...over});
test('auth is created without a popup/redirect resolver and keeps the default persistence order',()=>{
 let options;const auth=createAuth(sdk({initializeAuth:(app,o)=>{options=o;return {via:'initializeAuth',app};}}),'APP');
 assert.equal(auth.via,'initializeAuth');assert.deepEqual(options,{persistence:['idb','local','session']});assert.ok(!('popupRedirectResolver' in options));
});
test('an already initialised auth instance is reused; other errors are not swallowed',()=>{
 const again=createAuth(sdk({initializeAuth(){throw Object.assign(Error('x'),{code:'auth/already-initialized'});}}),'APP');assert.equal(again.via,'getAuth');
 assert.throws(()=>createAuth(sdk({initializeAuth(){throw Object.assign(Error('boom'),{code:'auth/internal-error'});}}),'APP'),/boom/);
});
test('the login code uses createAuth and no longer calls getAuth directly',()=>{
 const code=readFileSync('apps/web/src/features/auth.js','utf8');
 assert.match(code,/auth=createAuth\(authSDK,app\)/);assert.equal((code.match(/authSDK\.getAuth\(/g)||[]).length,1,'only the already-initialised fallback');
 assert.ok(!/signInWithPopup|signInWithRedirect|GoogleAuthProvider|getRedirectResult/.test(code),'popup/redirect flows are not used');
});
