import test from "node:test";import assert from "node:assert/strict";import {rankGameSearch} from "../lib/search";import {GAME_IDENTITIES} from "../lib/seed";
test("Korean aliases resolve to the same Game entity",()=>{for(const q of ["라이벌","라이벌즈","rivals"]){const r=rankGameSearch(GAME_IDENTITIES,q);assert.equal(r[0]?.universeId,6035872082,q);}});
test("99 Nights spacing and transliteration aliases resolve",()=>{for(const q of ["99나이트","99 나이트","99나잇"]){assert.equal(rankGameSearch(GAME_IDENTITIES,q)[0]?.universeId,7326934954);}});

test("new verified catalog aliases resolve",()=>{
  const cases:[string,number][]=[
    ["아스널",111958650],
    ["dti",5203828273],
    ["포세이큰",6331902150],
    ["비스웜",601130232],
    ["제일브레이크",245662005],
    ["자연재해 서바이벌",65241],
  ];
  for(const [query,id] of cases){
    assert.equal(rankGameSearch(GAME_IDENTITIES,query)[0]?.universeId,id,query);
  }
});
