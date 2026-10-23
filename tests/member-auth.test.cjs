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
const auth=load('lib/member-auth.ts',{'./active-session':{getActiveSession:async()=>null},'./supabase-server':{getServerSupabase(){throw Error('unexpected DB access');}}});
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
  '../../../../../lib/active-session':{getActiveSession:async()=>null},
  '../../../../../lib/supabase-server':{getServerSupabase(){calls++;throw Error('not configured');}}
});
const start=load('app/api/auth/kakao/start/route.ts',{
  '../../../../../lib/member-auth':auth,
  '../../../../../lib/session':sessions,
  '../../../../../lib/active-session':{getActiveSession:async()=>null},
  '../../../../../lib/supabase-server':{getServerSupabase(){throw Error('unexpected');}},
  '../../../../../lib/student-auth':{},'../../../../../lib/university-auth':{}
});
(async()=>{
  process.env.ACADEMY_INVITE_CODE='test-invite';
  for (const initial of ['rejected','pending','approved',null]) {
    let state=initial, updatePayload, insertCalls=0;
    const filters={};
    const db={from(table){
      if(table==='book_master')return {select(){return this;},eq(){return this;},in(){return Promise.resolve({data:[{book_name:'수학 교재'}],error:null});}};
      assert.equal(table,'sg_academy_requests');
      return {
        update(payload){updatePayload=payload;return {
          eq(key,value){filters[key]=value;return this;},
          async select(){assert.equal(filters.user_id,'member-test');assert.equal(filters.status,'rejected');
            if(state==='rejected'){state='pending';return {data:[{id:'request-test'}],error:null};}
            return {data:[],error:null};}
        };},
        async insert(payload){insertCalls++;assert.equal(payload.user_id,'member-test');
          if(state)return {error:{code:'23505'}};
          state='pending';return {error:null};}
      };
    }};
    const route=load('app/api/academy/requests/route.ts',{
      '../../../../lib/member-auth':{...auth,memberContext:async()=>({db,user:{id:'member-test',onboarding_complete:true,academy_username:null,school:'학교',grade:'고1'}}),rateLimit:async()=>true},
      '../../../../lib/staff-access':{staffSession:()=>null},
      '../../../../lib/supabase-server':{getServerSupabase:()=>db}
    });
    const request=()=>new NextRequest('https://studygyeol.vercel.app/api/academy/requests',{method:'POST',headers:{origin:'https://studygyeol.vercel.app','content-type':'application/json'},body:JSON.stringify({code:'test-invite',studentName:'학생',teacher:'이주백.T',className:'고1반',school:'학교',grade:'고1',books:['수학 교재']})});
    const result=await route.POST(request());
    assert.equal(result.status,initial==='pending'||initial==='approved'?409:200);
    assert.equal(state,initial==='approved'?'approved':'pending');
    if(initial==='rejected'){assert.equal(insertCalls,0);assert.equal(updatePayload.reviewer,null);assert.equal(updatePayload.reviewed_at,null);assert.equal((await route.POST(request())).status,409);}
  }
  for(const actor of ['이주백.T','전체 관리자','박병민.T']){
    let rpc;
    const route=load('app/api/academy/requests/route.ts',{
      '../../../../lib/member-auth':auth,
      '../../../../lib/staff-access':{staffSession:()=>actor},
      '../../../../lib/supabase-server':{getServerSupabase:()=>({rpc:async(name,args)=>{rpc={name,args};return actor==='박병민.T'?{error:{message:'forbidden'}}:{data:42,error:null};}})}
    });
    const request=new NextRequest('https://studygyeol.vercel.app/api/academy/requests',{method:'PATCH',headers:{origin:'https://studygyeol.vercel.app','content-type':'application/json'},body:JSON.stringify({id:'11111111-1111-4111-8111-111111111111',approve:true,newRoster:true,className:'고1반',school:'학교',grade:'고1',books:['수학 교재']})});
    const response=await route.PATCH(request);
    assert.equal(rpc.name,'sg_register_and_review_academy');
    assert.deepEqual(rpc.args.p_books,['수학 교재']);
    assert.equal(response.status,actor==='박병민.T'?409:200);
  }
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
  const registration=fs.readFileSync(path.join(root,'supabase/migrations/20261018_academy_register_and_review.sql'),'utf8');
  assert.ok(registration.includes('where id=p_request for update'));
  assert.ok(registration.includes("p_actor<>req.teacher_name"));
  assert.ok(registration.includes('insert into public.student_roster'));
  assert.ok(registration.includes('insert into public.users'));
  console.log('PASS: profile validation, role rejection, consent checks, signed member session, CSRF and missing OAuth state; migration security invariants. Database integration and live provider login still require configuration.');
})().catch(e=>{console.error(e);process.exitCode=1;});
