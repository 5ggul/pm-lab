import test from "node:test";import assert from "node:assert/strict";import {rankGameSearch} from "../lib/search";import {GAME_IDENTITIES} from "../lib/seed";
test("Korean aliases resolve to the same Game entity",()=>{for(const q of ["라이벌","라이벌즈","rivals"]){const r=rankGameSearch(GAME_IDENTITIES,q);assert.equal(r[0]?.universeId,6035872082,q);}});
test("99 Nights spacing and transliteration aliases resolve",()=>{for(const q of ["99나이트","99 나이트","99나잇"]){assert.equal(rankGameSearch(GAME_IDENTITIES,q)[0]?.universeId,7326934954);}});
