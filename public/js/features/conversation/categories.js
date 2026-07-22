// 회화 카테고리 정의 + 카테고리에서 대화 세션을 만드는 순수 로직.
// UI/저장소를 import하지 않는다(테스트 가능). 실제 화면 흐름은 ui.js가 이 데이터를 소비한다.
import {
  etcTopics, universityTopics, valuesTopics, studyTopics, careerTopics,
  hobbyMusicTopics, hobbySportsTopics, hobbyGameTopics,
} from "./topics.js";

// type: 세션을 만드는 방식.
//  - "topics": 주제 풀에서 신선한 주제 하나를 골라 시작.
//  - "romance": 설정에 고정된 연애 상대 페르소나로 시작.
//  - "counsel": 상담사 페르소나로 시작(상황만 신선하게 교체).
//  - "hobby": 하위(음악/스포츠/게임/자율)를 먼저 고른 뒤 시작.
export const CATEGORIES = [
  { id: "university", label: "🎓 대학 생활", type: "topics" },
  { id: "romance", label: "💕 연애", type: "romance" },
  { id: "values", label: "💭 가치관", type: "topics" },
  { id: "study", label: "📚 공부", type: "topics" },
  { id: "career", label: "💼 직업·미래", type: "topics" },
  { id: "counsel", label: "🧑‍🏫 상담", type: "counsel" },
  { id: "hobby", label: "🎨 취미", type: "hobby" },
  { id: "etc", label: "✨ 기타", type: "topics" },
];

// 취미 하위 선택. free(자율)는 파트너 오프닝 없이 플레이어가 먼저 말한다.
export const HOBBY_SUBS = [
  { id: "music", label: "🎵 음악" },
  { id: "sports", label: "⚽ 스포츠" },
  { id: "game", label: "🎮 게임" },
  { id: "free", label: "🎤 자율" },
];

const TOPIC_POOLS = {
  university: universityTopics,
  values: valuesTopics,
  study: studyTopics,
  career: careerTopics,
  etc: etcTopics,
  hobby_music: hobbyMusicTopics,
  hobby_sports: hobbySportsTopics,
  hobby_game: hobbyGameTopics,
};

/** 카테고리(+취미 하위)에 해당하는 주제 풀을 돌려준다. 없으면 빈 배열. */
export function topicPool(category, sub) {
  if (category === "hobby") return TOPIC_POOLS[`hobby_${sub}`] || [];
  return TOPIC_POOLS[category] || [];
}

/** id로 카테고리 정의를 찾는다. 없으면 null. */
export function findCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}
