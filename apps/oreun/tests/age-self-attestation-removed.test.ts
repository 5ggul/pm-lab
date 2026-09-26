import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const currentFiles=[
 "../app/me/page.tsx","../app/login/page.tsx","../app/privacy/page.tsx","../app/terms/page.tsx",
 "../app/youth/page.tsx","../app/actions/auth.ts","../app/actions/community.ts",
 "../app/actions/community-experience.ts","../app/actions/extra-composers.ts",
 "../app/auth/google/callback/route.ts","../app/game/[slug]/party/page.tsx",
 "../components/CommunityAccess.tsx","../lib/community/experience-model.ts","../lib/community/queries.ts"
];
test("current app no longer exposes or requires age self-attestation",()=>{
 for(const path of currentFiles){
  const source=readFileSync(new URL(path,import.meta.url),"utf8");
  assert.doesNotMatch(source,/age_confirmed_14_plus|만\s*14세|status:\s*"age"|access\s*===\s*"age"/,path);
 }
});
test("current access model depends on sign-in, availability and active status only",()=>{
 const source=readFileSync(new URL("../lib/community/experience-model.ts",import.meta.url),"utf8");
 assert.match(source,/permissions\.active \? "ready" : "restricted"/);
 assert.doesNotMatch(source,/age_confirmed/);
});
