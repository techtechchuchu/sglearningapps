const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {NextRequest,NextResponse} = require('next/server');

const filename = path.resolve(__dirname,'../app/api/account/management/route.ts');
const code = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let updatePayload, updatedTable, writes = 0;
const db = {from(table) {
  assert.ok(['users','student_roster'].includes(table), `unexpected table: ${table}`);
  const query = {
    select(){return this;}, eq(){return this;}, is(){return this;}, order(){return this;}, limit(){return this;},
    async single(){return {data:{username:'student-1',password_hash:'hash',phone:'',grade:'고1'},error:null};},
    update(payload){writes++; updatedTable=table; updatePayload=payload;return this;}
  };
  return query;
}};
const stubs = {
  'next/server':{NextResponse},
  '../../../../lib/member-auth':{sameOrigin:()=>true,failure:(message,status=503)=>NextResponse.json({message},{status})},
  '../../../../lib/session':{SESSION_COOKIE:'sg_session'},
  '../../../../lib/active-session':{getActiveSession:async()=>({role:'student',name:'student-1'})},
  '../../../../lib/supabase-server':{getServerSupabase:()=>db},
  '../../../../lib/student-auth':{passwordMatches:(entered)=>entered==='correct'},
  '../../../../lib/university-auth':{}
};
const mod={exports:{}};
new Function('require','module','exports',code)((id)=>{if(!(id in stubs))throw Error(`missing stub: ${id}`);return stubs[id];},mod,mod.exports);
const route=mod.exports;
const request=(body)=>new NextRequest('https://example.test/api/account/management',{method:'DELETE',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify(body)});

(async()=>{
  assert.equal((await route.DELETE(request({confirmation:'탈퇴',password:'wrong'}))).status,403);
  assert.equal(writes,0);
  const response=await route.DELETE(request({confirmation:'탈퇴',password:'correct'}));
  assert.equal(response.status,200);
  assert.equal(updatedTable,'users');
  assert.ok(updatePayload.withdrawn_at);
  assert.equal(updatePayload.phone,'');
  assert.equal(response.cookies.get('sg_session').value,'');
  const body=await response.json();
  assert.match(body.message,/기록은 삭제되지 않았습니다/);
  console.log('PASS: withdrawal changes only account status and clears phone/session; wrong password makes no write.');
})().catch(error=>{console.error(error);process.exitCode=1;});
