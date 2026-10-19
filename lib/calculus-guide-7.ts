export type GuideProblem = {
  number: number; title: string; section: string; question: string; answer: string;
  steps: string[]; note?: string;
};
const p = (number: number, title: string, section: string, question: string, answer: string, steps: string[], note?: string): GuideProblem => ({ number, title, section, question, answer, steps, note });

export const chapter7: GuideProblem[] = [
  p(1,"등비급수의 합","7.1",String.raw`3+2+\frac43+\frac89+\cdots`,String.raw`S=9`,[String.raw`a=3,\quad r=\frac23,\quad |r|<1`,String.raw`S=\frac{a}{1-r}=\frac3{1-\frac23}=9`]),
  p(2,"일반항으로 발산 판정","7.1",String.raw`\sum_{n=1}^{\infty}\frac{n}{n+5}`,String.raw`\text{발산}`, [String.raw`\lim_{n\to\infty}\frac{n}{n+5}=1\ne0`],"급수가 수렴하려면 일반항이 0으로 가야 합니다."),
  p(3,"부분분수로 항을 지우기","7.1",String.raw`\sum_{n=2}^{\infty}\frac2{n^2-1}`,String.raw`S=\frac32`,[String.raw`\frac2{n^2-1}=\frac1{n-1}-\frac1{n+1}`,String.raw`S_N=1+\frac12-\frac1N-\frac1{N+1}\longrightarrow\frac32`]),
  p(4,"부분합에서 일반항 찾기","7.1",String.raw`S_n=\frac{n-1}{n+1}\quad\text{일 때 }a_n\text{과 }S\text{를 구하시오}`,String.raw`a_1=0,\quad a_n=\frac2{n(n+1)}\ (n\ge2),\quad S=1`,[String.raw`a_1=S_1=0`,String.raw`a_n=S_n-S_{n-1}=\frac{n-1}{n+1}-\frac{n-2}{n}=\frac2{n(n+1)}\quad(n\ge2)`,String.raw`S=\lim_{n\to\infty}S_n=1`],"첫항은 별도로 계산해야 합니다."),
  p(5,"p급수의 합으로 나누기","7.2–7.3",String.raw`\sum_{n=1}^{\infty}\left(\frac2{n\sqrt n}+\frac3{n^3}\right)`,String.raw`\text{수렴}`, [String.raw`\sum_{n=1}^{\infty}\left(2n^{-3/2}+3n^{-3}\right)`,String.raw`\frac32>1,\quad3>1`],"두 급수 모두 p>1인 p급수이므로 합도 수렴합니다."),
  p(6,"적분판정법","7.2–7.3",String.raw`\sum_{n=1}^{\infty}ne^{-n^2}`,String.raw`\text{수렴}`, [String.raw`f(x)=xe^{-x^2},\quad f'(x)=e^{-x^2}(1-2x^2)<0\quad(x\ge1)`,String.raw`\int_1^{\infty}xe^{-x^2}\,dx=\left[-\frac12e^{-x^2}\right]_1^{\infty}=\frac1{2e}<\infty`],"1/(2e)는 비교에 사용한 적분값이지 급수의 합이 아닙니다."),
  p(7,"수렴하는 큰 급수와 비교","7.2–7.3",String.raw`\sum_{n=1}^{\infty}\frac1{n^2+n+1}`,String.raw`\text{수렴}`, [String.raw`0<\frac1{n^2+n+1}\le\frac1{n^2}`,String.raw`\sum_{n=1}^{\infty}\frac1{n^2}<\infty`]),
  p(8,"최고차항으로 비교 대상 고르기","7.2–7.3",String.raw`\sum_{n=1}^{\infty}\frac{2n^2+3n}{\sqrt{5+n^5}}`,String.raw`\text{발산}`, [String.raw`b_n=\frac1{\sqrt n}`,String.raw`\lim_{n\to\infty}\frac{(2n^2+3n)/\sqrt{5+n^5}}{1/\sqrt n}=2>0`,String.raw`\sum_{n=1}^{\infty}b_n=\sum_{n=1}^{\infty}n^{-1/2}=\infty`]),
  p(9,"삼각함수는 크기를 누르기","7.2–7.3",String.raw`\sum_{n=1}^{\infty}\frac{\cos^2n}{n^2+1}`,String.raw`\text{수렴}`, [String.raw`0\le\frac{\cos^2n}{n^2+1}\le\frac1{n^2}`,String.raw`\sum_{n=1}^{\infty}\frac1{n^2}<\infty`]),
  p(10,"조건부수렴의 전형","7.4",String.raw`\sum_{n=1}^{\infty}\frac{(-1)^{n-1}}{\sqrt n}`,String.raw`\text{조건부수렴}`, [String.raw`b_n=\frac1{\sqrt n}\searrow0`,String.raw`\sum_{n=1}^{\infty}|a_n|=\sum_{n=1}^{\infty}n^{-1/2}=\infty`],"교대급수는 수렴하지만 절댓값급수는 발산합니다."),
  p(11,"교대부호가 있어도 일반항 확인","7.4",String.raw`\sum_{n=1}^{\infty}(-1)^n\frac{3n-1}{2n+1}`,String.raw`\text{발산}`, [String.raw`\lim_{n\to\infty}\left|(-1)^n\frac{3n-1}{2n+1}\right|=\frac32\ne0`],"일반항이 0으로 가지 않으므로 교대급수판정법을 적용할 수 없습니다."),
  p(12,"로그가 들어간 조건부수렴","7.4",String.raw`\sum_{n=2}^{\infty}\frac{(-1)^n}{n\ln n}`,String.raw`\text{조건부수렴}`, [String.raw`\frac1{n\ln n}\searrow0`,String.raw`\int_2^M\frac{dx}{x\ln x}=\ln(\ln M)-\ln(\ln2)\longrightarrow\infty`],"교대급수는 수렴하지만 절댓값급수는 적분판정법으로 발산합니다."),
  p(13,"교대급수 오차가 0.001 이하","7.4",String.raw`S=\sum_{n=1}^{\infty}\frac{(-1)^{n-1}}n,\quad |S-S_N|\le0.001\text{ 이 되게 하시오}`,String.raw`N\ge999`, [String.raw`|S-S_N|\le b_{N+1}=\frac1{N+1}`,String.raw`\frac1{N+1}\le\frac1{1000}\quad\Longrightarrow\quad N\ge999`],"오차상계로 보장하는 항 수입니다. 실제 최소 항 수와 구별하세요."),
  p(14,"지수 대 다항식","7.5",String.raw`\sum_{n=1}^{\infty}\frac{5^n}{(n+1)^2 4^{n+2}}`,String.raw`\text{발산}`, [String.raw`a_n=\frac{5^n}{(n+1)^2 4^{n+2}}`,String.raw`\lim_{n\to\infty}\frac{a_{n+1}}{a_n}=\lim_{n\to\infty}\frac54\left(\frac{n+1}{n+2}\right)^2=\frac54>1`]),
  p(15,"계승이 분자에 있는 경우","7.5",String.raw`\sum_{n=1}^{\infty}\frac{n!}{10^n}`,String.raw`\text{발산}`, [String.raw`\frac{a_{n+1}}{a_n}=\frac{n+1}{10}\longrightarrow\infty>1`]),
  p(16,"계승이 분모에 있는 경우","7.5",String.raw`\sum_{n=1}^{\infty}\frac{2^n n^2}{(n+2)!}`,String.raw`\text{수렴}`, [String.raw`\frac{a_{n+1}}{a_n}=\frac{2(n+1)^2}{n^2(n+3)}\longrightarrow0<1`]),
  p(17,"근판정법으로 n제곱 제거","7.5",String.raw`\sum_{n=1}^{\infty}\left(\frac{1-3n}{3+4n}\right)^n`,String.raw`\text{절대수렴}`, [String.raw`\lim_{n\to\infty}\sqrt[n]{|a_n|}=\lim_{n\to\infty}\left|\frac{1-3n}{3+4n}\right|=\frac34<1`]),
  p(18,"한쪽 끝점만 포함","7.6",String.raw`\sum_{n=1}^{\infty}\frac{x^n}{\sqrt n}`,String.raw`R=1,\quad I=[-1,1)`, [String.raw`\lim_{n\to\infty}\left|\frac{a_{n+1}}{a_n}\right|=|x|`,String.raw`x=1:\ \sum\frac1{\sqrt n}=\infty,\qquad x=-1:\ \sum\frac{(-1)^n}{\sqrt n}\text{ 수렴}`]),
  p(19,"중심이 2인 멱급수","7.6",String.raw`\sum_{n=1}^{\infty}\frac{(x-2)^n}{n^2+1}`,String.raw`R=1,\quad I=[1,3]`, [String.raw`\lim_{n\to\infty}\left|\frac{a_{n+1}}{a_n}\right|=|x-2|`,String.raw`x=1,3:\quad\sum_{n=1}^{\infty}\frac{|x-2|^n}{n^2+1}=\sum_{n=1}^{\infty}\frac1{n^2+1}<\infty`]),
  p(20,"수렴반지름이 0인 경우","7.6",String.raw`\sum_{n=1}^{\infty}n!(2x-1)^n`,String.raw`R=0,\quad I=\left\{\frac12\right\}`, [String.raw`\left|\frac{a_{n+1}}{a_n}\right|=(n+1)|2x-1|`,String.raw`x\ne\frac12:\ L=\infty,\qquad x=\frac12:\ a_n=0`]),
  p(21,"모든 실수에서 수렴","7.6",String.raw`\sum_{n=1}^{\infty}\frac{x^n}{n!}`,String.raw`R=\infty,\quad I=(-\infty,\infty)`, [String.raw`\left|\frac{a_{n+1}}{a_n}\right|=\frac{|x|}{n+1}\longrightarrow0`]),
  p(22,"등비급수로 바꾸는 치환","7.7",String.raw`\frac{x}{9+x^2}`,String.raw`\frac{x}{9+x^2}=\sum_{n=0}^{\infty}\frac{(-1)^n x^{2n+1}}{9^{n+1}},\quad R=3,\ I=(-3,3)`, [String.raw`\frac{x}{9+x^2}=\frac{x}{9}\cdot\frac1{1-(-x^2/9)}`,String.raw`\left|\frac{x^2}{9}\right|<1\Longleftrightarrow |x|<3`],"x=±3에서는 일반항이 0으로 가지 않아 발산합니다."),
  p(23,"미분으로 분모의 제곱 만들기","7.7",String.raw`\frac1{(1+x)^2}`,String.raw`\frac1{(1+x)^2}=\sum_{n=0}^{\infty}(-1)^n(n+1)x^n,\quad R=1,\ I=(-1,1)`, [String.raw`\frac1{1+x}=\sum_{n=0}^{\infty}(-1)^n x^n`,String.raw`-\frac1{(1+x)^2}=\sum_{n=1}^{\infty}(-1)^n n x^{n-1}`],"양 끝점에서 일반항의 크기가 0으로 가지 않습니다."),
  p(24,"적분으로 로그 만들기","7.7",String.raw`\ln(1+x)`,String.raw`\ln(1+x)=\sum_{n=0}^{\infty}\frac{(-1)^n x^{n+1}}{n+1},\quad R=1,\ I=(-1,1]`, [String.raw`\ln(1+x)=\int_0^x\frac{dt}{1+t}`,String.raw`x=1:\ \sum_{n=0}^{\infty}\frac{(-1)^n}{n+1}\text{ 수렴},\quad x=-1:\ -\sum_{n=0}^{\infty}\frac1{n+1}\text{ 발산}`]),
  p(25,"arctan의 멱급수","7.7",String.raw`\arctan(2x)`,String.raw`\arctan(2x)=\sum_{n=0}^{\infty}\frac{(-1)^n2^{2n+1}x^{2n+1}}{2n+1},\quad R=\frac12,\ I=\left[-\frac12,\frac12\right]`, [String.raw`\frac{d}{dx}\arctan(2x)=\frac2{1+4x^2}=2\sum_{n=0}^{\infty}(-4)^n x^{2n}`,String.raw`\arctan(2x)=\int_0^x\frac2{1+4t^2}\,dt`,String.raw`x=\pm\frac12:\text{ 교대급수로 수렴}`]),
];

