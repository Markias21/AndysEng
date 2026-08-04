// 리스닝 데이터 경계. public/data/6min/index.json의 에피소드 목록을 읽어 온다.
//
// 이 파일에는 **링크와 메타만** 들어 있다(제목·날짜·오디오·대본 PDF 주소). BBC 대본은 저작물이라
// 레포에 담지 않고, 대본은 source.js가 열 때 브라우저가 downloads.bbc.co.uk에서 직접 받는다.
// 목록은 GitHub Actions(.github/workflows/voa.yml)가 매일 갱신한다.
const BASE = "data/6min";

let indexPromise = null;

/** 에피소드 목록. 한 세션에 한 번만 받아 재사용한다. 실패하면 다음 호출에서 다시 시도한다. */
export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}/index.json`, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`리스닝 목록을 불러오지 못했습니다 (${res.status})`);
        return res.json();
      })
      .catch((e) => {
        indexPromise = null;
        throw e;
      });
  }
  return indexPromise;
}

export async function episodes() {
  const { episodes: list } = await loadIndex();
  return list || [];
}

export async function findEpisode(id) {
  return (await episodes()).find((e) => e.id === id) || null;
}
