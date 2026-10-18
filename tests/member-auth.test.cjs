const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {createRequire} = require('node:module');
const {NextRequest,NextResponse} = require('next/server');
const root=path.resolve(__dirname,'..');
function load(file,stubs={}) {
  const filename=path.join(root,file),req=createRequire(filename);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',code)((id)=>id in stubs?stubs[id]:req(id),mod,mod.exports);
  return mod.exports;
}
process.env.SESSION_SECRET='test-only-session-secret-32-characters-minimum';
const sessions=load('lib/session.ts');
const auth=load('lib/member-auth.ts',{'./session':sessions,'./supabase-server':{getServerSupabase(){throw Error('unexpected DB access');}}});
const valid={name:'테스트',learnerType:'university',school:'테스트대학교',grade:'2학년',major:'수학',acceptTerms:true,acceptPrivacy:true,age14:true};
assert.equal(auth.profileInput(valid).learner_type,'university');
assert.equal(auth.profileInput({...valid,learnerType:'teacher'}),null);
assert.equal(auth.profileInput({...valid,acceptPrivacy:false}),null);
assert.equal(auth.profileInput({...valid,age14:false}),null);
assert.equal(auth.profileInput({...valid,learnerType:'school',grade:'중2'}).major,'');
assert.equal(auth.profileInput({...valid,learnerType:'school',grade:'2학년'}),null);
assert.equal(auth.profileInput({...valid,name:'x'.repeat(61)}),null);
assert.equal(auth.equalSecret('secret','secret'),true);
assert.equal(auth.equalSecret('secret','wrong'),false);
assert.equal(auth.sameOrigin(new NextRequest('https://studygyeol.vercel.app/api/account',{headers:{origin:'https://evil.example'}})),false);
assert.equal(auth.sameOrigin(new NextRequest('https://studygyeol.vercel.app/api/account',{headers:{origin:'https://studygyeol.vercel.app'}})),true);
const response=NextResponse.json({ok:true});sessions.setSession(response,'member','user-id');
const token=response.cookies.get('sg_session').value;
assert.equal(sessions.getSession(new NextRequest('https://example.test',{headers:{cookie:'sg_session='+token}})).role,'member');
assert.equal(sessions.getSession(new NextRequest('https://example.test',{headers:{cookie:'sg_session='+token+'tampered'}})),null);
let calls=0;
const callback=load('app/api/auth/kakao/callback/route.ts',{
  '../../../../../lib/member-auth':auth,
  '../../../../../lib/session':sessions,
  '../../../../../lib/supabase-server':{getServerSupabase(){calls++;throw Error('not configured');}}
});
const start=load('app/api/auth/kakao/start/route.ts',{
  '../../../../../lib/member-auth':auth,
  '../../../../../lib/session':sessions,
  '../../../../../lib/supabase-server':{getServerSupabase(){throw Error('unexpected');}},
  '../../../../../lib/student-auth':{},'../../../../../lib/university-auth':{}
});
(async()=>{
  const rejected=await start.POST(new NextRequest('https://studygyeol.vercel.app/api/auth/kakao/start',{method:'POST',headers:{origin:'https://evil.example'}}));
  assert.equal(rejected.status,403);
  const missing=await callback.GET(new NextRequest('https://studygyeol.vercel.app/api/auth/kakao/callback?code=test'));
  assert.equal(missing.status,307);assert.equal(calls,0);
  assert.equal(missing.cookies.get('sg_session'),undefined);
  const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261018_member_identity.sql'),'utf8');
  assert.ok(sql.includes('existing_email_login_required'));
  assert.ok(sql.includes('existing_student_login_required'));
  assert.ok(sql.includes('for update'));
  assert.ok(sql.includes('from public,anon,authenticated'));
  assert.ok(sql.includes('unique(provider,target_role,target_key)'));
  console.log('PASS: profile validation, role rejection, consent checks, signed member session, CSRF and missing OAuth state; migration security invariants. Database integration and live provider login still require configuration.');
})().catch(e=>{console.error(e);process.exitCode=1;});
