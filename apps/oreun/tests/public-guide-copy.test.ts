import assert from "node:assert/strict";
import test from "node:test";
import { VERIFIED_EDITORIAL_GUIDES } from "../lib/content/verified-guides";
import { publicGuideParagraphs } from "../lib/content/public-guide";

const editorialMeta = /(?:이 가이드는|이 페이지는|이 페이지에서는|별도 검증|임의로|단정하지|만들지 않습니다|추정하지|검증되지|자동으로 채우)/;

test("all public guide copy strips repeated editorial process language", () => {
  for (const guide of VERIFIED_EDITORIAL_GUIDES) {
    const paragraphs = publicGuideParagraphs(guide.body);
    assert.ok(paragraphs.length >= 2, guide.slug + " lost too much useful copy");
    const publicText = paragraphs.join(" ");
    assert.equal(editorialMeta.test(publicText), false, guide.slug + " leaked editorial boilerplate");
  }
});
