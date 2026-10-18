export type PythonLesson = {
  chapter: number;
  title: string;
  summary: string;
  points: string[];
  exampleTitle: string;
  exampleCode: string;
  exampleExplanation: string;
  challenge: string;
  starterCode: string;
  hint: string;
  solution: string;
  expected: string;
};

// Course topics are used as a syllabus; all explanations and exercises below are original.
export const pythonLessons: PythonLesson[] = [
  {
    chapter: 1, title: "파이썬 시작하기", summary: "파이썬 코드는 위에서 아래로 실행됩니다. print()로 결과를 화면에 표시하며, # 뒤에는 실행되지 않는 설명을 적을 수 있어요.",
    points: ["문장은 순서대로 실행돼요.", "print()는 괄호 안의 값을 출력해요.", "문자열은 따옴표로 감싸고, #은 주석을 시작해요."],
    exampleTitle: "나의 첫 출력", exampleCode: "print('안녕하세요!')\nprint('파이썬 연습을 시작합니다.')", exampleExplanation: "두 print()가 차례로 실행되어 두 줄이 출력됩니다.",
    challenge: "첫 줄에 내 이름, 둘째 줄에 '반가워요!'를 출력해 보세요.", starterCode: "# 아래에 print()를 두 번 작성해 보세요.\n", hint: "print('이름')처럼 문자열을 따옴표로 감싸세요.", solution: "print('민지')\nprint('반가워요!')", expected: "첫 줄에 이름, 둘째 줄에 반가워요!",
  },
  {
    chapter: 2, title: "변수", summary: "변수는 값을 붙잡아 두는 이름입니다. = 오른쪽의 값을 왼쪽 이름에 저장하고, 나중에 그 이름으로 값을 다시 사용할 수 있어요.",
    points: ["age = 20은 비교가 아니라 저장이에요.", "변수 이름은 숫자로 시작할 수 없어요.", "input()은 사용자 입력을 문자열로 받지만, 이 연습실 예제는 바로 실행할 수 있도록 미리 값을 넣었어요."],
    exampleTitle: "값 저장하고 다시 쓰기", exampleCode: "name = '지우'\nage = 20\nprint(name, '님의 나이는', age, '세')", exampleExplanation: "name과 age에 저장된 값을 출력할 때 다시 사용했습니다.",
    challenge: "price에 1200, count에 3을 저장하고 총금액을 출력해 보세요.", starterCode: "price = 1200\ncount = 3\n# 총금액을 출력해 보세요.\n", hint: "두 값을 곱할 때는 *를 사용해요.", solution: "price = 1200\ncount = 3\nprint(price * count)", expected: "3600",
  },
  {
    chapter: 3, title: "연산자", summary: "연산자는 값을 계산하거나 비교할 때 사용합니다. 산술 연산 결과와 비교 연산 결과는 서로 다른 자료형이에요.",
    points: ["+ - * /는 기본 계산, //는 몫, %는 나머지예요.", "==는 같은지 비교하고 =는 값을 저장해요.", "and, or, not으로 여러 조건을 조합할 수 있어요."],
    exampleTitle: "몫과 나머지", exampleCode: "candies = 17\nstudents = 4\nprint('한 명당', candies // students, '개')\nprint('남는 사탕', candies % students, '개')", exampleExplanation: "17을 4로 나누면 몫은 4, 나머지는 1입니다.",
    challenge: "25개의 연필을 6명에게 나눌 때 한 명당 개수와 남는 개수를 출력해 보세요.", starterCode: "pencils = 25\nstudents = 6\n# 몫과 나머지를 출력해 보세요.\n", hint: "//와 %를 각각 사용하세요.", solution: "pencils = 25\nstudents = 6\nprint(pencils // students)\nprint(pencils % students)", expected: "4와 1",
  },
  {
    chapter: 4, title: "데이터형과 문자열", summary: "숫자와 글자는 다르게 처리됩니다. 문자열은 일부를 잘라 내거나 여러 문자열을 이어 붙일 수 있어요.",
    points: ["int는 정수, float는 실수, str은 문자열이에요.", "문자열의 첫 글자 위치는 0이에요.", "숫자와 문자열을 더하려면 자료형을 맞춰야 해요."],
    exampleTitle: "문자열 일부 꺼내기", exampleCode: "subject = 'Python'\nprint(subject[0])\nprint(subject[:3])\nprint(len(subject))", exampleExplanation: "[0]은 첫 글자, [:3]은 앞의 세 글자, len()은 길이를 구합니다.",
    challenge: "word에 'university'를 넣고 앞의 4글자와 전체 길이를 출력해 보세요.", starterCode: "word = 'university'\n# 앞의 4글자와 길이를 출력해 보세요.\n", hint: "word[:4]와 len(word)를 사용해요.", solution: "word = 'university'\nprint(word[:4])\nprint(len(word))", expected: "univ와 10",
  },
  {
    chapter: 5, title: "조건문", summary: "조건문은 참·거짓에 따라 실행할 길을 나눕니다. 들여쓰기는 어떤 코드가 조건에 속하는지 결정해요.",
    points: ["if 다음 조건 끝에는 :을 붙여요.", "elif는 다른 조건, else는 나머지 경우예요.", "같은 블록은 같은 깊이로 들여써요."],
    exampleTitle: "점수에 따른 결과", exampleCode: "score = 82\nif score >= 90:\n    print('A')\nelif score >= 80:\n    print('B')\nelse:\n    print('다시 도전')", exampleExplanation: "82는 90 이상이 아니지만 80 이상이므로 B가 출력됩니다.",
    challenge: "temperature가 28 이상이면 '더워요', 아니면 '괜찮아요'를 출력해 보세요.", starterCode: "temperature = 29\n# if와 else를 작성해 보세요.\n", hint: "if temperature >= 28: 다음 줄을 들여쓰세요.", solution: "temperature = 29\nif temperature >= 28:\n    print('더워요')\nelse:\n    print('괜찮아요')", expected: "더워요",
  },
  {
    chapter: 6, title: "반복문", summary: "반복문은 같은 작업을 여러 번 실행합니다. 횟수가 정해졌으면 for, 조건이 유지되는 동안 반복하려면 while을 사용해요.",
    points: ["range(1, 5)는 1부터 4까지 만들어요.", "반복할 코드는 들여써서 묶어요.", "while은 종료 조건이 바뀌지 않으면 계속 반복될 수 있어요."],
    exampleTitle: "1부터 5까지 합계", exampleCode: "total = 0\nfor number in range(1, 6):\n    total += number\nprint(total)", exampleExplanation: "total에 1, 2, 3, 4, 5를 차례로 더해 15가 됩니다.",
    challenge: "for와 range()를 사용해 2, 4, 6, 8, 10을 한 줄씩 출력해 보세요.", starterCode: "# for 반복문을 작성해 보세요.\n", hint: "range(2, 11, 2)는 2씩 증가해요.", solution: "for number in range(2, 11, 2):\n    print(number)", expected: "2, 4, 6, 8, 10을 한 줄씩",
  },
  {
    chapter: 7, title: "리스트·튜플·딕셔너리", summary: "여러 값을 묶는 방법은 목적에 따라 다릅니다. 리스트는 수정할 수 있고, 튜플은 고정되며, 딕셔너리는 키로 값을 찾습니다.",
    points: ["리스트는 대괄호 [], 튜플은 소괄호 (), 딕셔너리는 중괄호 {}를 사용해요.", "리스트와 튜플은 위치로, 딕셔너리는 키로 값을 찾아요.", "append()는 리스트 끝에 새 항목을 추가해요."],
    exampleTitle: "점수 모으기", exampleCode: "scores = [80, 90]\nscores.append(100)\nstudent = {'name': '하린', 'scores': scores}\nprint(student['name'])\nprint(sum(student['scores']))", exampleExplanation: "리스트에 100을 추가하고, 딕셔너리의 키로 이름과 점수 목록을 꺼냈습니다.",
    challenge: "fruits 리스트에 '포도'를 추가하고, 첫 번째 과일과 전체 개수를 출력해 보세요.", starterCode: "fruits = ['사과', '바나나']\n# 포도를 추가하고 첫 항목, 개수를 출력해 보세요.\n", hint: "append(), fruits[0], len(fruits)를 차례로 써보세요.", solution: "fruits = ['사과', '바나나']\nfruits.append('포도')\nprint(fruits[0])\nprint(len(fruits))", expected: "사과와 3",
  },
];

