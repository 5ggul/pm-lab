const KNOWN=Object.freeze({
  SERVICE_KEY_IS_NULL:{code:'20',action:'요청에 인증키가 포함됐는지 확인'},
  PERMISSION_DENIED:{code:'20',action:'해당 API 활용신청·접근권한 확인'},
  SERVICE_ACCESS_DENIED_ERROR:{code:'20',action:'해당 API 활용신청 및 승인·중지 상태 확인'},
  LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR:{code:'22',action:'일일 호출량 초기화 대기 또는 트래픽 증설'},
  LIMITED_NUMBER_OF_SERVICE_REQUESTS_PER_SECOND_EXCEEDS_ERROR:{code:'23',action:'호출 간격을 늘린 뒤 재시도'},
  BLACKLIST_IP_ACCESS_ERROR:{code:'29',action:'호출 서버 IP 차단 여부 확인 및 활용지원센터 문의'},
  SERVICE_KEY_IS_NOT_REGISTERED_ERROR:{code:'30',action:'인증키 정확성·서비스 활용신청 완료·키 동기화 상태 확인'},
  DEADLINE_HAS_EXPIRED_ERROR:{code:'31',action:'인증키 이용기간 갱신'}
});

const clean=v=>String(v??'').trim().replace(/\s+/g,' ').slice(0,240);
const upper=v=>clean(v).toUpperCase().replace(/[ .-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');

function valuesByKeys(obj,keys,depth=0,out=[]){
  if(depth>7||obj==null)return out;
  if(Array.isArray(obj)){for(const x of obj)valuesByKeys(x,keys,depth+1,out);return out;}
  if(typeof obj!=='object')return out;
  for(const [k,v] of Object.entries(obj)){
    if(keys.has(k.toLowerCase())&&['string','number'].includes(typeof v))out.push(clean(v));
    if(v&&typeof v==='object')valuesByKeys(v,keys,depth+1,out);
  }
  return out;
}

export function classifyDataGoError(text='',httpStatus=null){
  const raw=String(text??'').trim();
  const codeKeys=new Set(['resultcode','returnreasoncode','errorcode','code']);
  const msgKeys=new Set(['resultmsg','returnauthmsg','errmsg','errormessage','message']);
  let codes=[],messages=[];
  try{
    const j=JSON.parse(raw);codes=valuesByKeys(j,codeKeys);messages=valuesByKeys(j,msgKeys);
  }catch{}
  if(!codes.length){
    for(const p of [/<(?:resultCode|returnReasonCode|errorCode|code)>\s*([^<]+)\s*<\/(?:resultCode|returnReasonCode|errorCode|code)>/gi]){
      for(const m of raw.matchAll(p))codes.push(clean(m[1]));
    }
  }
  if(!messages.length){
    for(const p of [/<(?:resultMsg|returnAuthMsg|errMsg|errorMessage|message)>\s*([^<]+)\s*<\/(?:resultMsg|returnAuthMsg|errMsg|errorMessage|message)>/gi]){
      for(const m of raw.matchAll(p))messages.push(clean(m[1]));
    }
  }
  const haystack=[...messages,raw.slice(0,1200)].map(upper).join('|');
  let kind=null;
  for(const name of Object.keys(KNOWN))if(haystack.includes(name)){kind=name;break;}
  const code=clean(codes.find(Boolean)||KNOWN[kind]?.code||'')||null;
  if(!kind&&code==='29')kind='BLACKLIST_IP_ACCESS_ERROR';
  if(!kind&&code==='30')kind='SERVICE_KEY_IS_NOT_REGISTERED_ERROR';
  if(!kind&&code==='31')kind='DEADLINE_HAS_EXPIRED_ERROR';
  const known=kind?KNOWN[kind]:null;
  return {
    kind:kind||((Number(httpStatus)===403)?'ACCESS_DENIED_UNCLASSIFIED':'UPSTREAM_ERROR_UNCLASSIFIED'),
    code,
    httpStatus:Number.isFinite(Number(httpStatus))?Number(httpStatus):null,
    action:known?.action||'공공데이터포털 오류코드와 활용신청 상태 확인'
  };
}

export const DATA_GO_KNOWN_ERRORS=KNOWN;
