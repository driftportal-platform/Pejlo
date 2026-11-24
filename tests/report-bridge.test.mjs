import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('Python log bridge decodes the real frames, validates signatures and preserves received times',()=>{
 const result=spawnSync(process.platform==='win32'?'python':'python3',['-B','-m','unittest','discover','-s','scripts/traccar-status','-p','test_bridge.py'],{encoding:'utf8',env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
