// 문단 연습 문항 약 200개의 집계. 형식은 { id, category, sourceTitle, text, type: "mcq"|"produce",
// question?: {stem, options[4], answer, evidence, explanation_ko}, task?: "restate"|"summary" }.
// 리딩 49편의 문단을 손으로 골라 만들었다 — public/data/reading/은 매일 오래된 기사를 지우며
// 도는 살아있는 데이터라, 원문 기사가 나중에 로테이션돼도 이미 임베드한 text는 그대로 유효하다.
// 카테고리별 파일로 나눈 이유는 essays-*.js와 같은 이유(한 파일이 너무 길어지는 것을 막기 위함).
import { scienceItems } from "./items-science.js";
import { healthItems } from "./items-health.js";
import { educationItems } from "./items-education.js";
import { historyItems } from "./items-history.js";
import { artsItems } from "./items-arts.js";
import { societyItems } from "./items-society.js";

export const CATEGORIES = [
  { id: "science", label: "🔬 과학·기술" },
  { id: "health", label: "🩺 건강·생활" },
  { id: "education", label: "🎓 교육" },
  { id: "history", label: "🏛 미국 역사" },
  { id: "arts", label: "🎨 예술·문화" },
  { id: "society", label: "🌏 시사·사회" },
];

export const ITEMS = [...scienceItems, ...healthItems, ...educationItems, ...historyItems, ...artsItems, ...societyItems];

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function findItem(id) {
  return ITEMS.find((i) => i.id === id) || null;
}

export function itemsOf(categoryId) {
  return categoryId ? ITEMS.filter((i) => i.category === categoryId) : ITEMS;
}
