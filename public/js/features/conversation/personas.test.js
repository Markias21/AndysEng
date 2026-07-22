import { test } from "node:test";
import assert from "node:assert/strict";
import {
  romancePersonas, counselPersona, oppositeGender, romancePartnersFor, findPersona,
} from "./personas.js";

test("반대 성별을 돌려준다", () => {
  assert.equal(oppositeGender("male"), "female");
  assert.equal(oppositeGender("female"), "male");
});

test("남성 플레이어에겐 여성 상대만 나온다", () => {
  const partners = romancePartnersFor("male");
  assert.ok(partners.length > 0);
  assert.ok(partners.every((p) => p.gender === "female"));
});

test("여성 플레이어에겐 남성 상대만 나온다", () => {
  const partners = romancePartnersFor("female");
  assert.ok(partners.length > 0);
  assert.ok(partners.every((p) => p.gender === "male"));
});

test("각 성별마다 안정형(1)~멘헤라(5) 5단계가 모두 있다", () => {
  for (const gender of ["female", "male"]) {
    const levels = romancePersonas.filter((p) => p.gender === gender).map((p) => p.level).sort();
    assert.deepEqual(levels, [1, 2, 3, 4, 5]);
  }
});

test("모든 연애 페르소나는 scene·opening·persona를 갖는다", () => {
  for (const p of romancePersonas) {
    assert.ok(p.scene && p.opening && p.persona, `${p.id} 누락`);
    assert.ok(p.trait && p.summary, `${p.id} 라벨 누락`);
  }
});

test("findPersona는 id로 찾고 없으면 null", () => {
  assert.equal(findPersona("emma")?.name, "Emma");
  assert.equal(findPersona("nope"), null);
});

test("상담사는 여러 상황(scene)을 갖고 각 scene에 id가 있다", () => {
  assert.ok(counselPersona.scenes.length >= 2);
  const ids = counselPersona.scenes.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "scene id 중복");
  for (const s of counselPersona.scenes) assert.ok(s.scene && s.opening && s.id);
});
