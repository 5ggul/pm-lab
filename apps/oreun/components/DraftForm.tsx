"use client";
import { useEffect,useRef,useState,type FormEvent,type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { WriteResult } from "@/lib/community/experience-model";
import { uuidPattern } from "@/lib/community/experience-model";
export default function DraftForm({userId,scope,kind,initialRequestId,fields,action,children,submitLabel}:{userId:string;scope:string;kind:"comment"|"party";initialRequestId:string;fields:string[];action:(data:FormData)=>Promise<WriteResult>;children:ReactNode;submitLabel:string}) {
  const router=useRouter();const formRef=useRef<HTMLFormElement>(null);const lock=useRef(false);const committed=useRef(false);
  const [ready,setReady]=useState(false),[pending,setPending]=useState(false),[requestId,setRequestId]=useState(initialRequestId),[result,setResult]=useState<WriteResult|null>(null),[notice,setNotice]=useState("");
  const key="oreun:"+kind+"-draft:v1:"+userId+":"+scope;
  const fieldKey=fields.join(",");
  function persist(){if(!formRef.current||committed.current)return;try{const data=new FormData(formRef.current);const values=Object.fromEntries(fields.map(name=>{const el=formRef.current?.elements.namedItem(name);return [name,el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLSelectElement?el.value.slice(0,5000):""];}));sessionStorage.setItem(key,JSON.stringify({userId,scope,kind,requestId:String(data.get("request_id")),values,savedAt:Date.now()}));}catch{}}
  useEffect(()=>{try{const raw=sessionStorage.getItem(key);if(raw){const d=raw.length<=20000?JSON.parse(raw):null;if(d&&d.userId===userId&&d.scope===scope&&d.kind===kind&&uuidPattern.test(d.requestId)&&Number.isFinite(d.savedAt)&&d.savedAt<=Date.now()+60000&&Date.now()-d.savedAt<86400000&&d.values&&typeof d.values==="object"){for(const name of fieldKey.split(",")){const e=formRef.current?.elements.namedItem(name);const v=d.values[name];if(typeof v==="string"&&v.length<=5000&&(e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement||e instanceof HTMLSelectElement)){if(e instanceof HTMLSelectElement){if([...e.options].some(o=>o.value===v))e.value=v;}else if(e.value===e.defaultValue)e.value=v.slice(0,e.maxLength>0?e.maxLength:5000);}}setRequestId(d.requestId);setNotice("이 탭에 저장된 초안을 불러왔어요.");}else sessionStorage.removeItem(key);}}catch{setNotice("임시저장을 사용할 수 없습니다. 입력과 등록은 가능합니다.");}setReady(true);},[key,userId,scope,kind,fieldKey]);
  useEffect(()=>{if(!ready)return;const flush=()=>persist();window.addEventListener("pagehide",flush);return()=>{flush();window.removeEventListener("pagehide",flush);};},[key,ready,fieldKey]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!ready||lock.current)return;const data=new FormData(event.currentTarget);persist();lock.current=true;setPending(true);setResult(null);try{const out=await action(data);setResult(out);if(out.status==="success"){committed.current=true;try{sessionStorage.removeItem(key);}catch{}formRef.current?.reset();setRequestId(crypto.randomUUID());setNotice("");if(out.href)router.push(out.href);router.refresh();}}catch{setResult({status:"error",message:"연결이 끊어졌습니다. 입력한 내용은 유지됩니다. 다시 등록해 주세요."});}finally{lock.current=false;setPending(false);}}
  function discard(){if(!confirm("작성 중인 초안을 지울까요?"))return;formRef.current?.reset();setRequestId(crypto.randomUUID());setResult(null);setNotice("");committed.current=true;try{sessionStorage.removeItem(key);}catch{}}
  return <form ref={formRef} onSubmit={submit} onInput={()=>{committed.current=false;persist();}} onChange={()=>{committed.current=false;persist();}} className="stack-form resilient-form" aria-busy={pending} data-testid={kind+"-composer"}>
    <input type="hidden" name="draft_user_id" value={userId}/><input type="hidden" name="request_id" value={requestId}/>
    <fieldset disabled={!ready||pending} className="draft-fields">{children}</fieldset>
    {result&&<div role={result.status==="success"?"status":"alert"} className="callout">{result.message}{result.href&&result.status!=="success"&&<p><a href={result.href}>확인하고 돌아오기 →</a></p>}</div>}
    <div className="button-row"><button type="submit" className="primary-button" disabled={!ready||pending}>{pending?"등록 중…":submitLabel}</button><button type="button" className="text-button" disabled={!ready||pending} onClick={discard}>초안 지우기</button></div>
    {notice&&<small role="status">{notice}</small>}<small>이 탭에서 마지막 저장 후 24시간까지 초안을 보관합니다.</small>
  </form>;
}
