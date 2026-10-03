import { test } from "node:test";
import assert from "node:assert/strict";
import { inflections, variantsOf } from "./inflect.js";

test("variantsOf: 원형을 먼저 시도하고 첫 단어·마지막 단어를 굴절시킨다", () => {
  const forms = variantsOf("pay off");

  assert.equal(forms[0], "pay off", "0번째는 항상 원형이다");
  assert.ok(forms.includes("pays off"));
  assert.ok(forms.includes("pay offs"));
  assert.deepEqual(variantsOf(""), []);
});

test("inflections: 어미에 따라 규칙이 갈린다", () => {
  assert.deepEqual(inflections("carry"), ["carry", "carrys", "carries", "carried", "carrying"]);
  assert.deepEqual(inflections("push"), ["push", "pushes", "pushed", "pushing"]);
  assert.deepEqual(inflections("make"), ["make", "makes", "maked", "making"]);
  // 짧은 CVC 단어는 자음을 반복한 형태도 후보에 넣는다.
  assert.ok(inflections("stop").includes("stopped"));
  assert.ok(inflections("stop").includes("stopping"));
});

test("variantsOf: 한 단어 표현은 마지막 단어 굴절을 중복해서 만들지 않는다", () => {
  const forms = variantsOf("improve");
  assert.equal(new Set(forms).size, forms.length);
});
