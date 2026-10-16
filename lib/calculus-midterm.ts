export type MathBlock = { text?: string; math?: string };
export type ExamQuestion = {
  id: string; number: string; title: string; points: 5 | 10;
  prompt: MathBlock[]; answer: MathBlock[]; solution: MathBlock[];
  graph?: { start: [number, number]; end: [number, number] };
};
type Vec = [number, number, number];
type Config = {
  id: string; title: string; a: Vec; b: Vec; combination: [number, number];
  point: Vec; direction: Vec; normals: [Vec, Vec]; constants: [number, number];
  geometric: number; telescope: number; alternating: number;
  nth: [number, number, number, number]; comparison: [number, number, number, number, number]; root: [number, number, number, number];
  graphStart: [number, number]; graphVector: [number, number];
  center: number; radius: number; atan: number; force: Vec; axis: Vec; plane: [Vec, Vec, Vec];
};

const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
export function fraction(a: number, b = 1): string {
  if (!b) throw new Error("Undefined fraction");
  const g = gcd(a, b); a /= g; b /= g;
  if (b < 0) { a = -a; b = -b; }
  return b === 1 ? String(a) : `${a < 0 ? "-" : ""}\\frac{${Math.abs(a)}}{${b}}`;
}
const vec = (v: number[], denominator = 1) => String.raw`\left(${v.map((n) => fraction(n, denominator)).join(",")}\right)`;
const dot = (a: Vec, b: Vec) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i]) as Vec;
const cross = (a: Vec, b: Vec): Vec => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const shifted = (variable: string, center: number) => center === 0 ? variable : `${variable}${center > 0 ? "-" : "+"}${Math.abs(center)}`;
const polynomial = (terms: [number, string][]) => terms.filter(([n]) => n !== 0).map(([n, term], i) => `${n < 0 ? "-" : i ? "+" : ""}${Math.abs(n) === 1 && term ? "" : Math.abs(n)}${term}`).join("") || "0";
const linear = (a: number, b: number) => polynomial([[a,"n"],[b,""]]);
const planeEquation = (n: Vec, c: number) => `${polynomial(n.map((v,i) => [v,["x","y","z"][i]]))}=${c}`;
const sqrt = (n: number) => Number.isInteger(Math.sqrt(n)) ? String(Math.sqrt(n)) : String.raw`\sqrt{${n}}`;
const math = (value: string): MathBlock => ({ math: value });
const text = (value: string): MathBlock => ({ text: value });

export const midtermConfigs: Config[] = [
  { id:"original", title:"원본 정답·해설", a:[1,2,0], b:[2,-1,2], combination:[2,3], point:[0,1,2], direction:[-1,2,4], normals:[[1,-2,-1],[2,-1,2]], constants:[1,3], geometric:3, telescope:2, alternating:1, nth:[1,-1,7,3], comparison:[1,1,4,-2,1], root:[2,1,5,-2], graphStart:[2,1], graphVector:[-1,2], center:0, radius:1, atan:2, force:[2,-3,1], axis:[1,2,2], plane:[[0,1,1],[1,0,1],[1,1,0]] },
  { id:"set-1", title:"변형 1세트", a:[2,-1,1], b:[1,2,2], combination:[3,2], point:[1,-1,2], direction:[2,3,-1], normals:[[1,1,0],[1,0,1]], constants:[2,3], geometric:2, telescope:3, alternating:2, nth:[2,1,5,-2], comparison:[2,3,3,1,2], root:[3,2,7,-1], graphStart:[1,1], graphVector:[2,1], center:1, radius:2, atan:3, force:[4,1,-2], axis:[2,-1,2], plane:[[1,0,0],[0,2,0],[0,0,3]] },
  { id:"set-2", title:"변형 2세트", a:[-1,2,1], b:[2,2,-1], combination:[2,4], point:[-2,1,0], direction:[3,-2,1], normals:[[1,2,2],[2,1,2]], constants:[4,5], geometric:4, telescope:4, alternating:3, nth:[3,-2,8,1], comparison:[3,2,5,-1,3], root:[4,-1,9,2], graphStart:[3,1], graphVector:[-2,2], center:-2, radius:3, atan:4, force:[1,4,-1], axis:[1,2,-2], plane:[[1,0,1],[0,2,1],[1,1,0]] },
  { id:"set-3", title:"변형 3세트", a:[1,-1,2], b:[-2,1,2], combination:[4,3], point:[2,0,-1], direction:[-1,3,2], normals:[[1,-1,1],[2,1,1]], constants:[2,4], geometric:5, telescope:2, alternating:4, nth:[4,1,9,2], comparison:[2,5,6,-3,2], root:[5,3,8,1], graphStart:[1,3], graphVector:[2,-2], center:2, radius:4, atan:5, force:[3,-1,2], axis:[2,2,1], plane:[[2,0,0],[0,3,0],[0,0,1]] },
];

export function buildExam(c: Config): ExamQuestion[] {
  const q: ExamQuestion[] = [];
  const add = (number: string, title: string, prompt: MathBlock[], answer: MathBlock[], solution: MathBlock[], points: 5 | 10 = 5) => {
    q.push({ id: `${c.id}-${q.length+1}`, number, title, points, prompt, answer, solution });
  };
  const shared = math(String.raw`\mathbf a=${vec(c.a)},\qquad\mathbf b=${vec(c.b)}`);
  const length = Math.sqrt(dot(c.b,c.b));
  const unit = vec(c.b,length);
  add("1-(1)","단위벡터",[shared,text("b 방향의 단위벡터를 구하시오.")],[math(unit)],[math(String.raw`\|\mathbf b\|=\sqrt{${c.b.map(n=>`(${n})^2`).join("+")}}=${length}`),text("벡터를 그 크기로 나누면 방향이 같고 크기가 1인 벡터가 된다."),math(String.raw`\frac{\mathbf b}{\|\mathbf b\|}=${unit}`)]);
  const [m,k] = c.combination;
  const combination = c.a.map((a,i)=>m*a-k*c.b[i]);
  add("1-(2)","벡터의 연산",[shared,text("다음 벡터를 계산하시오."),math(`${m}\\mathbf a-${k}\\mathbf b`)],[math(vec(combination))],[text("각 성분에 같은 연산을 적용한다."),math(`${m}\\mathbf a=${vec(c.a.map(a=>m*a))}`),math(`${k}\\mathbf b=${vec(c.b.map(b=>k*b))}`),math(`${m}\\mathbf a-${k}\\mathbf b=${vec(combination)}`)]);
  add("1-(3)","내적",[shared,text("두 벡터의 내적 a · b를 계산하시오.")],[math(String(dot(c.a,c.b)))],[text("같은 위치의 성분끼리 곱한 뒤 모두 더한다."),math(String.raw`\mathbf a\cdot\mathbf b=${c.a.map((n,i)=>`(${n})(${c.b[i]})`).join("+")}=${dot(c.a,c.b)}`)]);
  const line = ["x","y","z"].map((x,i)=>String.raw`\frac{${shifted(x,c.point[i])}}{${c.direction[i]}}`).join("=");
  add("1-(4)","직선의 대칭방정식",[text("점 P를 지나고 v와 평행한 직선의 대칭방정식을 구하시오."),math(String.raw`P=${vec(c.point)},\quad\mathbf v=${vec(c.direction)}`)],[math(line)],[text("v를 방향벡터로 삼고 P를 지나는 매개방정식을 세운다."),math(String.raw`(x,y,z)=${vec(c.point)}+t${vec(c.direction)}`),text("각 성분의 식에서 매개변수 t를 구해 서로 같다고 놓는다."),math(line),text("분모를 모두 같은 0이 아닌 상수로 곱한 동치식도 정답이다.")]);
  const [n1,n2] = c.normals;
  const ndot=Math.abs(dot(n1,n2)), normProduct=dot(n1,n1)*dot(n2,n2);
  const cosine=Number.isInteger(Math.sqrt(normProduct))?fraction(ndot,Math.sqrt(normProduct)):String.raw`\frac{${ndot}}{${sqrt(normProduct)}}`;
  const angle=normProduct===4*ndot*ndot?String.raw`\theta=\frac\pi3\;(60^\circ)`:String.raw`\theta=\cos^{-1}\!\left(${cosine}\right)`;
  add("1-(5)","두 평면 사이의 각",[text("다음 두 평면이 이루는 예각을 구하시오."),math(planeEquation(n1,c.constants[0])),math(planeEquation(n2,c.constants[1]))],[math(angle)],[text("각 평면의 계수에서 법선벡터를 읽는다."),math(String.raw`\mathbf n_1=${vec(n1)},\quad\mathbf n_2=${vec(n2)}`),text("예각을 구하므로 내적의 절댓값을 사용한다."),math(String.raw`\cos\theta=\frac{|\mathbf n_1\cdot\mathbf n_2|}{\|\mathbf n_1\|\|\mathbf n_2\|}=${cosine}`),math(angle),text("계산기 없이 역삼각함수로 나타낸 정확한 값도 정답이다.")]);
  const total = fraction(c.telescope*(c.geometric+1)-1,c.geometric+1);
  add("1-(6)","급수의 합",[text("다음 급수의 수렴값을 구하시오."),math(String.raw`\sum_{n=1}^{\infty}\left\{\left(-\frac1{${c.geometric}}\right)^n+\frac{${c.telescope}}{n(n+1)}\right\}`)],[math(total)],[text("첫 부분은 공비가 음수인 무한등비급수이다."),math(String.raw`\sum_{n=1}^{\infty}\left(-\frac1{${c.geometric}}\right)^n=-\frac1{${c.geometric+1}}`),text("두 번째 부분은 부분분수로 분해하면 중간 항이 소거된다."),math(String.raw`\frac{${c.telescope}}{n(n+1)}=${c.telescope}\left(\frac1n-\frac1{n+1}\right)`),math(String.raw`S_N=${c.telescope}\left(1-\frac1{N+1}\right)\longrightarrow${c.telescope}`),math(String.raw`S=-\frac1{${c.geometric+1}}+${c.telescope}=${total}`)]);
  add("1-(7)","교대급수의 수렴",[text("급수의 수렴 및 발산을 판정하시오."),math(String.raw`\sum_{n=1}^{\infty}\frac{(-1)^n n^2}{n^3+${c.alternating}}`)],[text("수렴한다. 정확히는 조건부 수렴이다.")],[math(String.raw`b_n=\frac{n^2}{n^3+${c.alternating}}\longrightarrow0`),text("항의 크기가 충분히 큰 n부터 감소함을 확인한다."),math(String.raw`b'(x)=\frac{x(${2*c.alternating}-x^3)}{(x^3+${c.alternating})^2}<0\quad(x>\sqrt[3]{${2*c.alternating}})`),text("유한 개의 처음 항은 수렴 여부에 영향을 주지 않는다. 교대급수판정법으로 원래 급수는 수렴한다."),math(String.raw`\lim_{n\to\infty}\frac{b_n}{1/n}=\lim_{n\to\infty}\frac{n^3}{n^3+${c.alternating}}=1`),text("절댓값 급수는 조화급수와 극한비교하여 발산한다. 따라서 조건부 수렴이다.")]);
  const [na,nb,nc,nd]=c.nth;
  add("1-(8)","일반항 판정",[text("급수의 수렴 및 발산을 판정하시오."),math(String.raw`\sum_{n=1}^{\infty}\frac{${linear(na,nb)}}{${linear(nc,nd)}}`)],[text("발산한다.")],[math(String.raw`\lim_{n\to\infty}\frac{${linear(na,nb)}}{${linear(nc,nd)}}=${fraction(na,nc)}\ne0`),text("급수가 수렴하려면 일반항이 0으로 가야 한다. 이 필요조건을 만족하지 않으므로 발산한다.")]);
  const [ca,cb,cc,cd,ce]=c.comparison;
  const numerator=polynomial([[1,"n^3"],[ca,"n"],[cb,""]]), denominator=polynomial([[cc,"n^3"],[cd,"n"],[ce,""]]);
  add("1-(9)","극한비교판정법",[text("급수의 수렴 및 발산을 판정하시오."),math(String.raw`\sum_{n=1}^{\infty}\frac{\sqrt{${numerator}}}{${denominator}}`)],[text("수렴한다.")],[text("분자의 크기는 n의 3/2제곱, 분모의 크기는 n의 3제곱이다. p = 3/2인 p급수와 비교한다."),math(String.raw`b_n=\frac1{n^{3/2}}`),math(String.raw`\lim_{n\to\infty}\frac{a_n}{b_n}=\frac1{${cc}}>0`),text("비율의 극한이 양의 유한한 수이고 p = 3/2 > 1이므로 비교급수가 수렴한다. 따라서 주어진 양항급수도 수렴한다.")]);
  const [ra,rb,rc,rd]=c.root;
  add("1-(10)","근판정법",[text("급수의 수렴 및 발산을 판정하시오."),math(String.raw`\sum_{n=1}^{\infty}\left(\frac{${linear(ra,rb)}}{${linear(rc,rd)}}\right)^n`)],[text("수렴한다.")],[text("일반항이 n제곱 꼴이므로 근판정법을 적용한다."),math(String.raw`\lim_{n\to\infty}\sqrt[n]{|a_n|}=\lim_{n\to\infty}\frac{${linear(ra,rb)}}{${linear(rc,rd)}}=${fraction(ra,rc)}<1`),text("따라서 급수는 수렴한다.")]);
  add("1-(11)","조건부 수렴의 예",[text("조건부 수렴하는 급수를 하나 적으시오.")],[text("예시 답안 (다른 올바른 예도 정답):"),math(String.raw`\sum_{n=1}^{\infty}\frac{(-1)^{n-1}}n`)],[text("양의 항 1/n은 감소하고 0으로 가므로 교대급수는 수렴한다. 절댓값을 취하면 조화급수가 되어 발산한다. 따라서 조건부 수렴이다."),text("다른 급수를 썼다면 원래 급수의 수렴과 절댓값 급수의 발산을 모두 확인하면 된다.")]);
  const end:[number,number]=[c.graphStart[0]+c.graphVector[0],c.graphStart[1]+c.graphVector[1]];
  add("1-(12)","벡터 그리기",[text("점 P를 시점으로 하는 벡터 u를 좌표평면에 그리시오."),math(String.raw`P=${vec(c.graphStart)},\quad\mathbf u=${vec(c.graphVector)}`)],[text("아래 시점에서 종점으로 향하는 화살표를 그린다."),math(`${vec(c.graphStart)}\\;\\longrightarrow\\;${vec(end)}`)],[text("시점의 좌표에 벡터의 각 성분을 더하여 종점을 구한다."),math(String.raw`Q=P+\mathbf u=${vec(c.graphStart)}+${vec(c.graphVector)}=${vec(end)}`),text("화살표의 시작은 P, 화살촉은 Q에 위치해야 한다.")]);
  q[q.length-1].graph={start:c.graphStart,end};
  const power=c.center?`(${shifted("x",c.center)})^n`:"x^n";
  const powerDenominator=c.radius===1?"n":String.raw`n\,${c.radius}^n`;
  add("2","수렴반경과 수렴구간",[text("다음 멱급수의 수렴반경과 수렴구간을 구하시오."),math(String.raw`\sum_{n=1}^{\infty}\frac{${power}}{${powerDenominator}}`),...(c.id==="original"?[text("원문은 n=0부터이나 분모가 n이어서 첫 항이 정의되지 않습니다. 이 해설은 시작 지수를 n=1로 보정한 식을 기준으로 합니다.")]:[])],[math(String.raw`R=${c.radius},\qquad I=[${c.center-c.radius},\,${c.center+c.radius})`)],[text("절댓값의 연속항 비에 비판정법을 적용한다."),math(String.raw`L=\frac{|${shifted("x",c.center)}|}{${c.radius}}<1`),math(String.raw`${c.center-c.radius}<x<${c.center+c.radius},\qquad R=${c.radius}`),text("왼쪽 끝점에서는 교대조화급수가 되어 수렴한다."),math(String.raw`x=${c.center-c.radius}:\quad\sum_{n=1}^{\infty}\frac{(-1)^n}n`),text("오른쪽 끝점에서는 조화급수가 되어 발산한다."),math(String.raw`x=${c.center+c.radius}:\quad\sum_{n=1}^{\infty}\frac1n`),math(String.raw`I=[${c.center-c.radius},\,${c.center+c.radius})`)],10);
  const series=String.raw`\sum_{n=0}^{\infty}\frac{(-1)^n(${c.atan}x)^{2n+1}}{2n+1}`;
  add("3","역탄젠트의 멱급수",[text("다음 함수의 멱급수 표현과 수렴반경을 구하시오."),math(String.raw`f(x)=\tan^{-1}(${c.atan}x)`),text("여기서 tan⁻¹은 역탄젠트 함수이다.")],[math(String.raw`\tan^{-1}(${c.atan}x)=${series}`),math(String.raw`R=\frac1{${c.atan}}`)],[text("기본 등비급수에 −t²를 대입한 후 0부터 적분한다."),math(String.raw`\frac1{1+t^2}=\sum_{n=0}^{\infty}(-1)^n t^{2n}\quad(|t|<1)`),math(String.raw`\tan^{-1}t=\sum_{n=0}^{\infty}\frac{(-1)^nt^{2n+1}}{2n+1}`),text(`t = ${c.atan}x를 대입한다.`),math(String.raw`\tan^{-1}(${c.atan}x)=${series}`),math(String.raw`|${c.atan}x|<1\quad\Longrightarrow\quad R=\frac1{${c.atan}}`),text("양 끝점에서도 교대급수판정법으로 수렴한다. 따라서 위 급수 표현은 양 끝점을 포함해서도 성립한다.")],10);
  const fd=dot(c.force,c.axis), vv=dot(c.axis,c.axis);
  const av=c.axis.map(v=>fd*v), bv=c.force.map((f,i)=>f*vv-av[i]);
  add("4","힘의 수직분해",[text("힘 F를 v와 평행한 성분 a와 v에 수직인 성분 b로 분해하시오. 두 벡터를 모두 구하시오."),math(String.raw`\mathbf F=${vec(c.force)},\quad\mathbf v=${vec(c.axis)}`)],[math(String.raw`\mathbf a=${vec(av,vv)}`),math(String.raw`\mathbf b=${vec(bv,vv)}`)],[text("평행 성분 a는 F의 v 위로의 정사영이다."),math(String.raw`\mathbf a=\frac{\mathbf F\cdot\mathbf v}{\mathbf v\cdot\mathbf v}\mathbf v`),math(String.raw`\mathbf F\cdot\mathbf v=${fd},\qquad\mathbf v\cdot\mathbf v=${vv}`),math(String.raw`\mathbf a=${fraction(fd,vv)}\mathbf v=${vec(av,vv)}`),text("전체 힘에서 평행 성분을 빼면 수직 성분을 얻는다."),math(String.raw`\mathbf b=\mathbf F-\mathbf a=${vec(bv,vv)}`),text("검산: 두 성분의 합은 F이며, 수직 성분과 v의 내적은 0이다."),math(String.raw`\mathbf a+\mathbf b=\mathbf F,\qquad\mathbf b\cdot\mathbf v=0`)],10);
  const [A,B,C]=c.plane, AB=sub(B,A), AC=sub(C,A), normal=cross(AB,AC);
  const g=gcd(gcd(normal[0],normal[1]),normal[2]), sign=normal.find(n=>n!==0)!<0?-1:1;
  const reduced=normal.map(n=>n/g*sign) as Vec;
  const equation=planeEquation(reduced,dot(reduced,A));
  add("5","세 점을 지나는 평면",[text("다음 세 점을 지나는 평면의 방정식을 구하시오."),math(String.raw`A=${vec(A)},\quad B=${vec(B)}`),math(String.raw`C=${vec(C)}`)],[math(equation)],[text("평면 위의 평행하지 않은 두 벡터를 구한다."),math(String.raw`\overrightarrow{AB}=${vec(AB)},\quad\overrightarrow{AC}=${vec(AC)}`),text("두 벡터의 외적은 평면의 법선벡터이다."),math(String.raw`\overrightarrow{AB}\times\overrightarrow{AC}=${vec(normal)}`),math(String.raw`\mathbf n=${vec(reduced)}`),text("법선벡터와 점 A를 사용해 평면의 방정식을 구한다."),math(String.raw`\mathbf n\cdot\big((x,y,z)-${vec(A)}\big)=0`),math(equation),text("세 점을 모두 대입해 성립하는지 확인할 수 있다. 방정식 전체에 같은 0이 아닌 상수를 곱한 식도 정답이다.")],10);
  return q;
}

export const midtermSets = midtermConfigs.map((config) => ({ id:config.id, title:config.title, questions:buildExam(config) }));
