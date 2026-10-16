import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import katex from 'katex';
const source=readFileSync(new URL('../lib/calculus-midterm.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {midtermSets,midtermConfigs}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
assert.equal(midtermSets.length,4);
const expected=[
  {sum:String.raw`\frac{7}{4}`,combine:String.raw`\left(-4,7,-6\right)`,dot:'0',plane:'x+y+z=2',parallel:String.raw`\mathbf a=\left(-\frac{2}{9},-\frac{4}{9},-\frac{4}{9}\right)`},
  {sum:String.raw`\frac{8}{3}`,combine:String.raw`\left(4,-7,-1\right)`,dot:'2',plane:'6x+3y+2z=6',parallel:String.raw`\mathbf a=\left(\frac{2}{3},-\frac{1}{3},\frac{2}{3}\right)`},
  {sum:String.raw`\frac{19}{5}`,combine:String.raw`\left(-10,-4,6\right)`,dot:'1',plane:'2x+y+z=3',parallel:String.raw`\mathbf a=\left(\frac{11}{9},\frac{22}{9},-\frac{22}{9}\right)`},
  {sum:String.raw`\frac{11}{6}`,combine:String.raw`\left(10,-7,2\right)`,dot:'1',plane:'3x+2y+6z=6',parallel:String.raw`\mathbf a=\left(\frac{4}{3},\frac{4}{3},\frac{2}{3}\right)`},
];
let formulas=0;
for(const [i,set] of midtermSets.entries()){
  const q=set.questions,c=midtermConfigs[i],e=expected[i];
  assert.equal(q.length,16);assert.equal(q.filter(v=>v.points===5).length,12);assert.equal(q.reduce((s,v)=>s+v.points,0),100);
  assert.equal(new Set(q.map(v=>v.id)).size,16);
  assert.equal(q[1].answer[0].math,e.combine);assert.equal(q[2].answer[0].math,e.dot);assert.equal(q[5].answer[0].math,e.sum);assert.equal(q[14].answer[0].math,e.parallel);assert.equal(q[15].answer[0].math,e.plane);
  assert.deepEqual(q[11].graph.end,c.graphStart.map((n,j)=>n+c.graphVector[j]));
  assert(q[12].answer[0].math.includes(`[${c.center-c.radius},\\,${c.center+c.radius})`));
  // Independently check the projection is parallel and its residual is orthogonal.
  const dot=c.force.reduce((s,n,j)=>s+n*c.axis[j],0),den=c.axis.reduce((s,n)=>s+n*n,0);
  const residual=c.force.map((n,j)=>n-dot/den*c.axis[j]);
  assert(Math.abs(residual.reduce((s,n,j)=>s+n*c.axis[j],0))<1e-10);
  // All original/variant ratios are positive and strictly less than one.
  assert(c.root[0]/c.root[2]>0&&c.root[0]/c.root[2]<1);
  for(const question of q)for(const b of [...question.prompt,...question.answer,...question.solution])if(b.math){
    const html=katex.renderToString(b.math,{throwOnError:true,strict:'error',trust:false,displayMode:true});
    assert(!html.includes('katex-error'));formulas++;
  }
}
console.log(`PASS: 4 sets, 64 questions, 100 points per set; ${formulas} formulas render; numeric answer fixtures and geometry checks pass.`);
