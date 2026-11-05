import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {normalizeAccountState} from '../dist/src/features/account-state.js';

test('legacy account keys cannot override application map configuration',()=>{
 assert.equal(normalizeAccountState({mapKey:'old-private-account-key'}).mapKey,'');
});
test('build injects the shared public key, defaults to streets and rejects URLs',()=>{
 const root=mkdtempSync(join(tmpdir(),'pejlo-build-'));
 try{
  for(const name of ['apps','packages','scripts'])cpSync(name,join(root,name),{recursive:true});
  const run=key=>spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,env:{...process.env,MAPTILER_API_KEY:key},encoding:'utf8'});
  assert.equal(run('test-public-key_123').status,0);
  const config=readFileSync(join(root,'dist/src/config/maps.js'),'utf8');
  assert.match(config,/"apiKey":"test-public-key_123"/);assert.match(config,/"defaultLayer":"streets"/);
  assert.equal(run('').status,0);assert.match(readFileSync(join(root,'dist/src/config/maps.js'),'utf8'),/"apiKey":""/);
  assert.notEqual(run('https://example.com/?key=bad').status,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
