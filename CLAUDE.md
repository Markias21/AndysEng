CLAUDE.md

프로젝트 개요

영어 학습 앱. 핵심 도메인: 어휘 학습(vocabulary), 간격 반복 복습(review), 퀴즈(quiz), 학습 진도(progress).
사용자 가치의 중심은 복습 스케줄링과 학습 데이터의 정확성이다. 이 부분의 코드 품질을 최우선으로 한다.
이 프로그램은 회화를 배우긴 하나 토플 공부를 위해 만들어졌다. 예문을 만들거나 공부 방향을 짤 때 유의할 것
토플 문제 형식과 공부에 대한 아이디어의 경우 https://blog.naver.com/messijessi/224253337626를 참고한다.
2026-01-21 개편 이후의 신형 토플을 기준으로 삼는다. 진행 중인 구조 재편은 `재설계 계획.md` 참고.

기술 스택

- 정적 PWA (서버 없음, 의존성 0개). public/이 앱 전부이며 GitHub Pages 등 정적 호스팅에 배포한다.
- 빌드 스텝 없는 vanilla JS (브라우저 네이티브 ES 모듈). 개발 서버는 dev-server.js (node 내장 http).
- AI: 브라우저가 Supabase Edge Function `claude-proxy`(supabase/functions/claude-proxy)를 통해 Anthropic REST API를 호출, 모델 claude-sonnet-5 (public/js/shared/claude.js 경계 뒤에만 존재). 진짜 Anthropic 키는 브라우저에 없고 Edge Function 비밀값으로만 있다.
- 로그인 정보(닉네임): 비밀번호로 암호화(PBKDF2→AES-GCM)해 localStorage 보관 (public/js/shared/keyvault.js). 계정 자체(닉네임+비밀번호)는 Supabase Auth가 담당.
- 저장소: localStorage 단일 JSON (public/js/shared/store.js)이 1차 저장소이고, 학습 기록은 Supabase(Postgres, 무료 등급)의 `andyseng_data` 테이블에 수동/자동 저장·불러오기 (public/js/shared/supabase.js). 리포트는 File System Access API로 로컬 폴더 저장 (public/js/shared/localfs.js)

자주 쓰는 명령어

npm run dev        # 개발 서버 (http://localhost:3000)
npm test           # 전체 테스트 (node --test)

핵심 원칙 (모든 코드 작성 시 적용)

1. 의존성 방향


도메인 로직(복습 알고리즘, 채점, 진도 계산)은 프레임워크, DB, UI를 절대 import하지 않는다.
의존 방향은 항상: UI/API → 애플리케이션 로직 → 도메인. 역방향 금지.
외부 서비스(TTS, 사전 API 등)는 인터페이스 뒤에 두고, 도메인은 인터페이스만 안다.


2. YAGNI — 미리 만들지 않기


현재 요구사항에 없는 추상화, 설정 옵션, 제네릭 구조를 만들지 않는다.
구현체가 하나뿐인 인터페이스는 만들지 않는다. (외부 서비스 경계는 예외)
"나중에 필요할 것 같다"는 이유로 코드를 추가하려면 먼저 사용자에게 물어본다.


3. 기능 단위 구조


폴더는 레이어가 아니라 기능(feature) 기준으로 나눈다.

좋음: features/vocabulary/, features/review/, features/quiz/
피함: 최상위 controllers/, services/, utils/ 로만 나누는 구조



한 기능의 코드는 한 폴더 안에서 완결되게 한다. 기능 간 공유는 shared/로 명시적으로만.


4. 크기와 복잡도 제한


함수는 한 가지 일만 한다. 함수 이름에 "and"가 들어가면 분리를 검토한다.
파일이 300줄을 넘으면 분리를 검토하고, 분리 계획을 먼저 제안한다.
조건문 중첩이 3단계를 넘으면 early return 또는 함수 추출로 평탄화한다.


5. 테스트


도메인 로직(복습 스케줄, 채점, 진도 계산)은 반드시 단위 테스트를 함께 작성한다.
테스트는 구현이 아니라 동작을 검증한다. 리팩터링해도 깨지지 않는 테스트를 지향.
버그 수정 시: 버그를 재현하는 테스트를 먼저 추가하고 수정한다.


6. 네이밍과 도메인 용어


코드에서 도메인 용어를 통일한다: word(단어), deck(단어장), card(복습 카드), reviewSession(복습 세션), interval(복습 간격), streak(연속 정답/연속 학습일), due(다음 복습 시각). 동의어 혼용 금지.
새 도메인 용어가 필요하면 이 섹션에 추가한다.

7. 작업 방식


큰 변경(새 기능, 구조 변경) 전에는 계획을 먼저 제시하고 확인받는다. 확실하지 않다면 반드시 유저에게 실시간으로 질문하면서 정답을 찾아가라.
기존 코드 스타일과 패턴을 따른다. 새 패턴 도입은 이유와 함께 제안 먼저.
에러는 삼키지 않는다. 처리하거나 명시적으로 전파한다.
주석은 "무엇"이 아니라 "왜"를 설명할 때만 쓴다.
코드를 작성하고 나면 AI는 커밋을 메시지와 함께 진행한다.
반드시 한글로 개발자에게 코드를 수정한 것에 대해 설명한다.
같은 성능에서 토큰 사용량을 줄일 수 있는 방법을 찾아 적용한다.

8. 하지 말 것


요청하지 않은 라이브러리 추가 금지. 필요하면 이유와 함께 제안.
테스트 없이 도메인 로직 변경 금지.
죽은 코드, 주석 처리된 코드 남기기 금지.

아키텍처 결정 기록 (ADR)

결정은 영역별로 docs/adr/ 에 나눠 기록한다. 형식: `- 날짜 | 결정 | 이유`.
Claude는 기록된 결정을 뒤집는 제안을 하기 전에 그 영역 파일을 읽고 해당 항목을 반드시 언급한다.
새 결정은 작업한 영역 파일 맨 아래에 추가한다. 여러 영역에 걸치면 가장 중심인 한 곳에만 적고 다른 영역에서 한 줄로 참조한다.

- docs/adr/infra.md — 인프라·배포·인증·동기화 (정적 PWA 전환, Supabase, 가입 승인제, Claude 프록시, 서비스 워커)
- docs/adr/cost.md — AI 비용·토큰 정책 (콘텐츠 로컬화, 모델 선택, 프롬프트 캐싱)
- docs/adr/scoring.md — 채점·등급·CEFR 레벨 (4대 축 절대 기준, 9단계 등급, 학습 달력)
- docs/adr/conversation.md — 회화 (8개 카테고리, 페르소나, scene, 표현 수집 주기)
- docs/adr/writing.md — 글쓰기·글쓰기 기본 (첨삭, 빈칸 인출, 이메일 유형, 구조 제시, Q&A)
- docs/adr/reading.md — 리딩·문단 연습 (VOA 파이프라인, 문제 세트, 비용 확인창)
- docs/adr/listening.md — 리스닝·3분 학습 (VOA 받아쓰기, BBC 6 Minute English)
- docs/adr/srs.md — 복습 (간격 사다리, 하루 상한·leech·인터리빙, 예문 빈칸 인출)
- docs/adr/tools.md — 공용 도구 (사전, 번역기, 스킵, 최근 항목 회피)

진행 중인 재편은 `재설계 계획.md`를 따른다 (2026 신형 토플 기준 재구성, 탭 8→5개, 스피킹 신설).

함정·불변식 (고치기 전에 반드시 확인)

ADR이 아니라 "매번 밟는 지뢰"다. 코드만 봐서는 알 수 없고, 어기면 대부분 조용히 깨진다.

- `appendRecord`에 `id` 필드를 넣지 말 것. `quiz` 기록의 `id`는 복습 카드 id이고 `features/srs/history.js`가 그걸로 카드별 이력을 찾는다. 기록 고유 id가 필요하면 `rid`를 쓴다.
- store에 마이그레이션이 없다. `data.version`을 읽는 코드가 어디에도 없고 호환은 `store.js`의 `normalize()` 얕은 merge가 전담한다. 새 profile 필드·새 기록 종류·새 최상위 배열은 그냥 추가하면 기존 데이터에 자동 흡수된다. `version` 범프는 읽히지 않는 메모일 뿐이다.
- 새 기록 종류를 추가하면 네 곳을 함께 고친다(빼먹으면 조용히 사라진다): `store.js`의 `RECORD_KINDS`(안 하면 `appendRecord`가 TypeError) / `features/stats/stats.js`의 종류별 for-of(안 하면 통계·달력에 안 뜸) / `features/stats/ui.js`의 `UNSYNCED_LABELS`(영문 키가 그대로 노출) / `features/report/ui.js`의 `total`(리포트가 "기록 없음"으로 거부). 현재 `writingBasic`이 stats에서 누락된 상태다.
- `shared/cloze.js`의 `buildCloze` 매칭은 순수 리터럴 부분 문자열이다. `"insulate ... from"`처럼 끊긴 표현은 절대 안 잡힌다 — 실제로 붙어 있는 연속된 단어만 표현으로 쓴다.
- 손으로 쓴 데이터의 `blanks[].expression`·`evidence`는 본문에 등장하는 형태 그대로여야 한다(수 일치·관사 포함). "become accessible"이라 써도 본문이 "becomes accessible"이면 안 잡힌다. `essays.test.js`·`sets.test.js`가 이걸 잡는다.
- CSP는 `index.html`의 meta 하나다. `media-src`를 빠뜨리면 `default-src`로 폴백해 오디오가 조용히 막힌다(2026-08-02~08-04에 실제로 발생). 인라인 `style=`도 `style-src 'self'`에 막히므로 스타일은 전부 `styles.css`에 클래스로 둔다.
- `sw.js`는 파일을 추가할 때 `VERSION`과 `ASSETS` 둘 다 고친다. network-first라 누락이 온라인에서는 전혀 드러나지 않고 오프라인에서만 깨진다. `addAll`은 하나라도 404면 install 전체가 실패한다.
- VOA rssfeeds 페이지의 라벨은 실제 피드와 한 칸 밀려 있다. 피드를 바꿀 땐 반드시 받아서 `<channel><title>`로 확인한다.
- Anthropic 구조화 출력 스키마는 배열의 `minItems`(0·1 외)·`maxItems`·`minimum`/`maximum`을 지원하지 않는다. 개수·범위는 description과 프롬프트로 지시하고 응답을 받은 뒤 로컬에서 검증한다.
- `shared/pdf-text.js`의 MacRoman 표는 정확히 128자여야 한다(0xCA 비분리 공백, 0xF0 애플 로고를 빠뜨리면 뒤가 한 칸씩 밀린다). 바이트↔문자 1:1이 필요하면 `TextDecoder("latin1")`이 아니라 `String.fromCharCode`를 쓴다.
- 운영 작업은 사람이 손으로 한다: Supabase 마이그레이션(`supabase/*.sql`)은 SQL Editor 실행, Edge Function `claude-proxy`는 대시보드 배포, Secrets 수동 설정, 최초 관리자 승격은 `scripts/db.js`(service_role).
- 검증은 playwright가 없으므로 `chrome-headless-shell`을 CDP로 직접 몬다(node 내장 WebSocket). 390px 폭 가로 스크롤 없음은 매번 확인한다.
