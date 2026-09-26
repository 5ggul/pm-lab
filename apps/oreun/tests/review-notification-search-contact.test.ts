import test from "node:test";
import assert from "node:assert/strict";
import {resolveNotificationTarget, type TargetReader} from "../lib/community/notification-target";
import type {NotificationRow} from "../lib/community/queries";
import {rankGameSearch} from "../lib/search";
import {GAME_IDENTITIES} from "../lib/seed";
import {privateContact} from "../lib/private-contact";
const q="bd9ea736-f636-4570-8ee9-e48c4fce100f",a="bd9ea736-f636-4570-8ee9-e48c4fce101f",c="bd9ea736-f636-4570-8ee9-e48c4fce102f",other="bd9ea736-f636-4570-8ee9-e48c4fce103f";
const item={question_id:q,answer_id:a,comment_id:c,kind:"answer_comment"} as NotificationRow;
const read:TargetReader=async table=>table==="questions"?{id:q}:table==="answers"?{id:a,question_id:q,author_id:other}:{id:c,answer_id:a,author_id:other};
test("notifications resolve only visible consistent parent/child, never dead anchors",async()=>{
 assert.equal(await resolveNotificationTarget(item,"rivals",read),`/questions/${q}#comment-${c}`);
 for(const table of ["answers","comments"]){const target=await resolveNotificationTarget(item,"rivals",async(t,id)=>t===table?null:read(t,id));assert.match(target,table==="answers"?/notice=answer_unavailable#answers/:/notice=comment_unavailable#comments/);}
 assert.match(await resolveNotificationTarget(item,"rivals",async(t,id)=>t==="answers"?{id:a,question_id:other,author_id:other}:read(t,id)),/notice=answer_unavailable/);
 assert.match(await resolveNotificationTarget(item,"rivals",async(t,id)=>t==="comments"?{id:c,answer_id:other,author_id:other}:read(t,id)),/notice=comment_unavailable/);
 assert.match(await resolveNotificationTarget(item,"rivals",async(t,id)=>t==="comments"?{id:c,answer_id:a,author_id:null}:read(t,id)),/notice=comment_unavailable/);
 await assert.rejects(resolveNotificationTarget(item,"rivals",async()=>{throw new Error("DB unavailable, not deleted");}));
});
test("specific search false positives disappear without weakening exact or alias matches",()=>{
 const find=(q:string)=>rankGameSearch(GAME_IDENTITIES,q).map(g=>g.slug);
 assert.equal(find("99 나이트").includes("pls-donate"),false);assert.equal(find("dress").includes("doors"),false);
 assert.equal(find("어돕미")[0],"adopt-me");assert.equal(find("라이벌즈")[0],"rivals");assert.equal(find("RIVALS")[0],"rivals");assert.equal(find("블프")[0],"blox-fruits");
});
test("private contact is absent without verified owner configuration and never GitHub/credentials",()=>{
 assert.equal(privateContact({}),null);assert.equal(privateContact({R1_PRIVATE_CONTACT_EMAIL:"operator@example.test"}),null);
 for(const url of ["https://github.com/org/issues/new","http://example.test/form","https://user:password@example.test/form"])assert.equal(privateContact({R1_PRIVATE_CONTACT_VERIFIED:"1",R1_PRIVATE_CONTACT_URL:url}),null);
 assert.ok(privateContact({R1_PRIVATE_CONTACT_VERIFIED:"1",R1_PRIVATE_CONTACT_EMAIL:"operator@example.test"}));
 const r=privateContact({R1_PRIVATE_CONTACT_VERIFIED:"1",R1_PRIVATE_CONTACT_EMAIL:"a?bcc=x@example.test"});assert.ok(!r?.href.includes("?"));
});
