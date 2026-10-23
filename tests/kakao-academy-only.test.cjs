const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {createRequire}=require('node:module');
const {NextRequest}=require('next/server');
const root=path.resolve(__dirname,'..');
function load(file,stubs={}){
  const filename=path.join(root,file),req=createRequire(filename);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',code)((id)=>id in stubs?stubs[id]:req(id),mod,mod.exports);
  return mod.exports;
}
process.env.SESSION_SECRET='test-only-session-secret-32-characters-minimum';
process.env.KAKAO_CLIENT_ID='test-client';
process.env.KAKAO_CLIENT_SECRET='test-secret';
const session=load('lib/session.ts');
const auth=load('lib/member-auth.ts',{'./active-session':{getActiveSession:async()=>null},'./supabase-server':{getServerSupabase(){throw Error('unexpected')}}});
function query(data){return {eq(){return this;},gt(){return this;},select(){return this;},delete(){return this;},maybeSingle:async()=>({data,error:null})};}
const originalFetch=global.fetch;
global.fetch=async url=>({ok:true,json:async()=>String(url).includes('/oauth/token')?{access_token:'test-token'}:{id:12345}});
async function callbackFor(identity,member){
  let rpcCalls=0;
  const db={from(table){
    if(table==='sg_oauth_attempts')return query({target_role:null,target_key:null,session_hash:null});
    if(table==='sg_identities')return query(identity);
    if(table==='university_users')return query(member);
    throw Error('unexpected table '+table);
  },rpc(){rpcCalls++;throw Error('login must not create an identity');}};
  const route=load('app/api/auth/kakao/callback/route.ts',{
    '../../../../../lib/member-auth':auth,
    '../../../../../lib/session':session,
    '../../../../../lib/supabase-server':{getServerSupabase:()=>db}
  });
  const response=await route.GET(new NextRequest('https://studygyeol.vercel.app/api/auth/kakao/callback?state=state&code=code',{headers:{cookie:'sg_kakao_state=browser'}}));
  return {response,rpcCalls,message:new URL(response.headers.get('location')).searchParams.get('auth_message')};
}
(async()=>{
  const start=load('app/api/auth/kakao/start/route.ts',{
    '../../../../../lib/member-auth':{...auth,rateLimit:async()=>true,memberContext:async()=>({user:{id:'member-id',academy_username:null}})},
    '../../../../../lib/active-session':{getActiveSession:async()=>({role:'member',name:'member-id'})},
    '../../../../../lib/supabase-server':{getServerSupabase:()=>({from(){throw Error('unapproved member must not reach identity storage');}})},
    '../../../../../lib/session':session,
    '../../../../../lib/student-auth':{},
    '../../../../../lib/university-auth':{}
  });
  const linkRequest=new NextRequest('https://studygyeol.vercel.app/api/auth/kakao/start',{method:'POST',headers:{origin:'https://studygyeol.vercel.app','content-type':'application/json'},body:JSON.stringify({intent:'link'})});
  const denied=await start.POST(linkRequest);
  assert.equal(denied.status,403);
  assert.match((await denied.json()).message,/학원 연결 승인 후/);
  const unlinked=await callbackFor(null,null);
  assert.match(unlinked.message,/신규 가입은 지원하지 않습니다/);
  assert.equal(unlinked.response.cookies.get('sg_session'),undefined);
  assert.equal(unlinked.rpcCalls,0);
  const pending=await callbackFor({target_role:'member',target_key:'member-id'},{id:'member-id',academy_username:null,withdrawn_at:null});
  assert.match(pending.message,/학원 연결 승인 후/);
  assert.equal(pending.response.cookies.get('sg_session'),undefined);
  const approved=await callbackFor({target_role:'member',target_key:'member-id'},{id:'member-id',academy_username:'academy-student',withdrawn_at:null});
  assert.equal(approved.message,null);
  assert.equal(approved.response.cookies.get('sg_session')?.value?true:false,true);
  assert.equal(approved.rpcCalls,0);
  console.log('PASS: Kakao login cannot create an account or enter an unapproved academy account; approved linked member can log in.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{global.fetch=originalFetch;});
