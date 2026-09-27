import { uuidPattern } from "./experience-model";
export const ANSWER_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const PREFIX = "oreun:answer-draft:v1:";
export type AnswerDraft = {version:1;userId:string;questionId:string;requestId:string;body:string;savedAt:number};
export function answerDraftKey(userId:string,questionId:string){return PREFIX+userId+":"+questionId;}
export function loadAnswerDraft(storage:Pick<Storage,"getItem"|"removeItem">,userId:string,questionId:string,now=Date.now()):AnswerDraft|null{
 const key=answerDraftKey(userId,questionId);const raw=storage.getItem(key);if(!raw)return null;if(raw.length>24000){storage.removeItem(key);return null;}
 try{const data=JSON.parse(raw);const valid=data.version===1&&data.userId===userId&&data.questionId===questionId&&uuidPattern.test(data.requestId??"")&&typeof data.body==="string"&&data.body.length<=5000&&typeof data.savedAt==="number"&&Number.isFinite(data.savedAt)&&data.savedAt<=now+60000&&now-data.savedAt<ANSWER_DRAFT_TTL_MS;if(!valid){storage.removeItem(key);return null;}return {version:1,userId,questionId,requestId:data.requestId,body:data.body,savedAt:data.savedAt};}catch{storage.removeItem(key);return null;}
}
export function persistAnswerDraft(storage:Pick<Storage,"setItem"|"removeItem">,draft:AnswerDraft){const key=answerDraftKey(draft.userId,draft.questionId);if(!draft.body)storage.removeItem(key);else storage.setItem(key,JSON.stringify(draft));}
