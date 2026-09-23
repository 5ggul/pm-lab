import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const root = new URL("../", import.meta.url).pathname;
function sources(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name==="api"?[]:sources(join(dir,e.name))):/\.(tsx?|svg)$/.test(e.name)?[join(dir,e.name)]:[]);}
test("public surfaces use the approved Korean brand",()=>{for(const file of [...sources(join(root,"app")),...sources(join(root,"components"))]) assert.equal(readFileSync(file,"utf8").includes("오름"),false,file);for(const p of ["components/Header.tsx","components/Footer.tsx","app/layout.tsx","app/login/page.tsx"])assert.ok(readFileSync(join(root,p),"utf8").includes("로블잼"),p);});
test("rename preserves sessions and installed draft keys",()=>{assert.match(readFileSync(join(root,"lib/auth/session.ts"),"utf8"),/oreun_access/);assert.match(readFileSync(join(root,"lib/community/answer-draft.ts"),"utf8"),/oreun:answer-draft/);});
