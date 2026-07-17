# AndysEng
회화 및 글쓰기에 특화되어 영어를 배울 수 있는 웹앱 기반 프로그램

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 전체 테스트
```

## 환경 변수 (.env)

`.env` 파일에 아래 값을 넣으면 기능이 활성화된다 (`--env-file-if-exists`로 주입). 키가 없어도 서버는 뜨며, 해당 기능만 비활성화된다.

| 변수 | 설명 |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API 키. 없으면 AI 채점/대화 비활성화. |
| `GOOGLE_CLIENT_ID` | 구글 OAuth 클라이언트 ID. 없으면 로그인/드라이브 저장 비활성화. |
| `GOOGLE_CLIENT_SECRET` | 구글 OAuth 클라이언트 시크릿. |
| `GOOGLE_REDIRECT_URI` | (선택) OAuth 콜백 URL. 기본값 `http://localhost:3000/api/auth/google/callback`. |

### 구글 OAuth 키 발급 (요약)

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 생성.
2. **API 및 서비스 → 라이브러리**에서 **Google Drive API** 사용 설정.
3. **OAuth 동의 화면** 구성. 스코프에 `.../auth/drive`가 포함되므로 테스트 사용자로 본인 계정을 추가.
4. **사용자 인증 정보 → OAuth 클라이언트 ID (웹 애플리케이션)** 생성.
   - 승인된 리디렉션 URI에 `http://localhost:3000/api/auth/google/callback` 추가.
5. 발급된 클라이언트 ID/시크릿을 `.env`에 넣으면 바로 동작한다.

## 로그인 & 드라이브 저장

- 구글 계정으로 로그인/가입한다 (멀티유저 — 사용자별로 학습 기록이 분리된다).
- 학습 후 **"공부 끝내기"** 버튼을 누르면, 지난 리포트 이후의 기록을 본인 구글 드라이브에 저장한다.
  - `AndysEng/YYYY-MM-DD.md` (사람이 읽는 리포트) + `.json` (원본 기록). 같은 날 2번째부터 `-2`, `-3` … 번호가 붙는다.
- **AndysNote 연동** 토글을 켜면 저장 위치가 `AndysNote/AndysEng/`로 바뀌고, 기존 `AndysEng` 폴더도 그 안으로 이동한다.
