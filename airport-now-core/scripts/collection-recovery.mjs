// All transports receive their remaining time budget and must enforce it.
export async function collectWithRecovery({worker,runner,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),budgetMs=390000}){
  const deadline=now()+budgetMs;
  const attempt=async(fn,name,limit)=>{
    const remaining=Math.min(limit,deadline-now());
    if(remaining<=0)return {ok:false,retryable:false,error:'COLLECTION_DEADLINE'};
    return fn(name,remaining);
  };
  let result=await attempt(worker,'primary',150000);
  if(result.ok||result.retryable===false)return result;
  result=await attempt(runner,'runner',90000);
  if(result.ok||result.retryable===false)return result;
  if(deadline-now()<140000)return {ok:false,error:'RECOVERY_BUDGET_EXHAUSTED'};
  await sleep(10000);
  return attempt(worker,'recovery',150000);
}
export function retryableFailure(report,task){
  if([400,401,403,404,413,415].includes(report.httpStatus))return false;
  const code=report.result?.[task]?.error||report.error||'';
  return !/^(GATEWAY_(10|12|20|22|29|30|31)|SERVICE_KEY_NOT_IN_EXECUTION_ENV|KEY_NOT_IN_REQUEST|INGEST_AUTH_NOT_CONFIGURED)$/.test(code);
}
