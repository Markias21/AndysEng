// scripts/gen-reading-sets.js가 미리 만들어 public/data/reading/sets/에 커밋해 둔 문제 세트를
// 검증한다. 손으로 쓴 게 아니라 AI가 만든 데이터지만, "레포에 실려 배포되는" 이상 essays.test.js와
// 같은 이유로 테스트가 필요하다 — 이후 누군가 지문을 고치거나 세트를 다시 만들 때 깨짐을 잡아 준다.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveBlanks } from "./passage.js";
import { validQuestions } from "./score.js";

const READING_DIR = fileURLToPath(new URL("../../../data/reading/", import.meta.url));
const SETS_DIR = `${READING_DIR}sets/`;

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const files = await readdir(SETS_DIR).catch(() => []);

test("미리 생성된 문제 세트가 최소 1개는 있다", () => {
  assert.ok(files.length > 0, "public/data/reading/sets/에 파일이 없습니다.");
});

for (const file of files) {
  const articleId = file.replace(".json", "");

  test(`${articleId}: 문제 세트가 지문에 실제로 대응한다`, async () => {
    const [article, set] = await Promise.all([readJSON(`${READING_DIR}${articleId}.json`), readJSON(`${SETS_DIR}${file}`)]);

    const questions = validQuestions(set.questions);
    assert.ok(questions.length >= 4, `유효한 객관식이 4개 미만 (${questions.length}개)`);
    for (const q of questions) {
      assert.ok(article.paragraphs.some((p) => p.text.includes(q.evidence)), `근거 문장이 지문에 없음: "${q.evidence}"`);
    }

    const blanks = resolveBlanks(article, set.blanks);
    assert.ok(blanks.length >= 3, `지문에서 되찾은 빈칸이 3개 미만 (${blanks.length}개)`);

    assert.ok(set.main_idea?.length > 0, "main_idea가 비어 있음");
    assert.ok(Array.isArray(set.key_points) && set.key_points.length >= 3, "key_points가 3개 미만");
    assert.ok(
      article.paragraphs.some((p) => p.text.includes(set.restate_sentence)),
      `restate_sentence가 지문에 없음: "${set.restate_sentence}"`
    );
  });
}
