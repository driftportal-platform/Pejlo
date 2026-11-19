import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mobileAccessText} from '../apps/web/src/features/mobile-access-status.js';

test('account permission distinguishes enabled, disabled, unknown and failed refresh',()=>{
 assert.match(mobileAccessText({enabled:true}),/^Slået til/);
 assert.match(mobileAccessText({enabled:false}),/^Slået fra/);
 assert.match(mobileAccessText(),/^Henter/);
 assert.match(mobileAccessText({error:true}),/kunne ikke hentes/);
 assert.doesNotMatch(mobileAccessText({error:true}),/Slået fra/);
 assert.match(mobileAccessText({enabled:true,error:true}),/^Senest kendte status: Slået til/);
 assert.match(mobileAccessText({enabled:false,error:true}),/^Senest kendte status: Slået fra/);
});
