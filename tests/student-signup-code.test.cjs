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
process.env.STUDENT_SIGNUP_CODE='test-code';
const auth=load('lib/member-auth.ts',{'./active-session':{getActiveSession:async()=>null},'./supabase-server':{getServerSupabase(){throw Error('unexpected')}}});
let inserted=0,student=null;
const db={from(table){
  if(table==='users')return {
    filters:{},
    select(){return this;},
    eq(field,value){this.filters[field]=value;return this;},ilike(field,value){this.filters[field]=value;return this;},limit(){return this;},order(){return this;},
    async maybeSingle(){return {data:student && Object.entries(this.filters).every(([field,value])=>student[field]===value)?student:null,error:null};},
    async range(){return {data:student?[{username:student.username}]:[],error:null};},
    insert(row){inserted++;assert.equal(row.username,'새학생');assert.equal(row.login_id,'new_student');assert.equal(row.grade,'고1');assert.equal(row.email,'student@example.com');assert.equal(row.phone,'01012345678');assert.equal(row.signup_status,'pending');assert.ok(row.terms_accepted_at);assert.ok(row.privacy_accepted_at);assert.equal(row.password_hash.length,64);student={...row};return {select(){return this;},async single(){return {data:{username:row.username},error:null};}};},
    update(payload){return {eq(){return this;},async select(){student={...student,...payload};return {data:[{username:student.username}],error:null};}};}
  };
  if(table==='student_roster')return {select(){return this;},eq(){return this;},neq(){return this;},limit(){return Promise.resolve({data:[{id:1,grade:'고1'}],error:null});},async range(){return {data:[],error:null};}};
  throw Error('unexpected table '+table);
}};
const route=load('app/api/auth/student/signup/route.ts',{
  '../../../../../lib/member-auth':{...auth,rateLimit:async()=>true},
  '../../../../../lib/session':{getSession:()=>null},
  '../../../../../lib/supabase-server':{getServerSupabase:()=>db},
  '../../../../../lib/student-auth':load('lib/student-auth.ts')
});
function request(body,origin='https://studygyeol.vercel.app'){
  return new NextRequest('https://studygyeol.vercel.app/api/auth/student/signup',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({username:'새학생',loginId:'new_student',password:'secure-password-123',grade:'고1',email:'student@example.com',phone:'01012345678',signupCode:'test-code',age14:true,acceptTerms:true,acceptPrivacy:true,...body})});
}
(async()=>{
  assert.equal((await route.POST(request({},'https://evil.example'))).status,403);
  assert.equal((await route.POST(request({signupCode:'wrong'}))).status,403);
  assert.equal((await route.POST(request({password:'short'}))).status,400);
  assert.equal((await route.POST(request({loginId:'한글'}))).status,400);
  assert.equal((await route.POST(request({email:''}))).status,400);
  assert.equal((await route.POST(request({phone:''}))).status,400);
  assert.equal((await route.POST(request({acceptPrivacy:false}))).status,400);
  assert.equal(inserted,0);
  assert.equal((await route.POST(request({}))).status,202);
  assert.equal(inserted,1);
  assert.equal(student.signup_status,'pending');
  assert.equal((await route.POST(request({}))).status,409);
  assert.equal(inserted,1);
  const login=load('app/api/auth/student/route.ts',{
    '../../../../lib/session':{setSession(){}},
    '../../../../lib/supabase-server':{getServerSupabase:()=>db},
    '../../../../lib/student-auth':load('lib/student-auth.ts')
  });
  const loginRequest=()=>new NextRequest('https://studygyeol.vercel.app/api/auth/student',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'new_student',password:'secure-password-123'})});
  assert.equal((await login.POST(loginRequest())).status,403);
  const deniedAdmin=load('app/api/admin/student-signups/route.ts',{
    '../../../../lib/member-auth':auth,
    '../../../../lib/staff-access':{staffSession:()=> '이주백.T'},
    '../../../../lib/supabase-server':{getServerSupabase:()=>db}
  });
  assert.equal((await deniedAdmin.PATCH(new NextRequest('https://studygyeol.vercel.app/api/admin/student-signups',{method:'PATCH',headers:{origin:'https://studygyeol.vercel.app','content-type':'application/json'},body:JSON.stringify({username:'새학생',approve:true})}))).status,403);
  const admin=load('app/api/admin/student-signups/route.ts',{
    '../../../../lib/member-auth':auth,
    '../../../../lib/staff-access':{staffSession:()=> '전체 관리자'},
    '../../../../lib/supabase-server':{getServerSupabase:()=>db}
  });
  const pending=await admin.GET(new NextRequest('https://studygyeol.vercel.app/api/admin/student-signups'));
  assert.equal(pending.status,200);
  const approval=new NextRequest('https://studygyeol.vercel.app/api/admin/student-signups',{method:'PATCH',headers:{origin:'https://studygyeol.vercel.app','content-type':'application/json'},body:JSON.stringify({username:'새학생',approve:true})});
  assert.equal((await admin.PATCH(approval)).status,200);
  assert.equal(student.signup_status,'approved');
  assert.equal((await login.POST(loginRequest())).status,200);
  console.log('PASS: signup code creates a pending student; only explicit admin approval activates it. Invalid code, weak password, missing consent, CSRF and duplicates are rejected.');
})().catch(error=>{console.error(error);process.exitCode=1;});
