import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const hierarchyPath=path.join(root,'data','generated','service-hierarchy.json');
const catalogPath=path.join(root,'data','generated','all-car-catalog.json');
const h=JSON.parse(fs.readFileSync(hierarchyPath,'utf8'));
const c=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const key=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]+/g,'');
const stable=(p,v)=>`${p}-${crypto.createHash('sha1').update(v).digest('hex').slice(0,16)}`;
const uniq=a=>[...new Set(a.filter(Boolean))];
const sortKo=(a,b)=>String(a??'').localeCompare(String(b??''),'ko',{numeric:true,sensitivity:'base'});

const RULES=[
  {maker:/^쎄미시스코$/i,name:'D2C',targetFamilyId:'family-856f82d55bf84ab0',force:true,re:/^D2C$/i},
  {maker:/^Volkswagen$/i,name:'Atlas TSI',targetFamilyId:'family-87212586eacd16ee',force:true,re:/^Atlas TSI$/i},
  {maker:/^Brilliance Shineray$/i,name:'이티밴',targetFamilyId:'family-5eeaa1ad7764db67',force:true,re:/^이티밴$/i},
  {maker:/^MINI$/i,canonicalMaker:'Brilliance Shineray',makerId:'maker-fbfeb6744606ad63',name:'이티밴 미니',targetFamilyId:'family-95297a2c89021776',force:true,re:/^이티밴 미니$/i},
  {maker:/^Brilliance Shineray$/i,name:'이티밴 엑스',targetFamilyId:'family-b4f2d2f28f9f521e',force:true,re:/^이티밴 엑스$/i},
  {maker:/^Brilliance Shineray$/i,name:'이티밴 프로',targetFamilyId:'family-0e03ea663f2de15d',force:true,re:/^이티밴 프로$/i},
  // Exact one-model families from the current public efficiency feed.  These
  // rules do not infer a generation or merge similar names: they only record
  // the maker/model spelling already present in the source so the result no
  // longer falls back to the raw-name bucket.
  {maker:/^루트17$/i,name:'e-TOVI',targetFamilyId:'family-a07f1421c59cb8ed',force:true,re:/^e-TOVI$/i},
  {maker:/^쎄미시스코$/i,name:'D2P',targetFamilyId:'family-76dd87e1e98c0b3c',force:true,re:/^D2P$/i},
  {maker:/^어울림$/i,name:'스피라',targetFamilyId:'family-7857a1bc41ef70ee',force:true,re:/^스피라$/i},
  {maker:/^진우에스엠씨$/i,name:'포텐스',targetFamilyId:'family-ada252c7e47ef888',force:true,re:/^포텐스$/i},
  {maker:/^케이모터$/i,name:'MG ZS EV',targetFamilyId:'family-bc7daa73c54b7a6f',force:true,re:/^MG ZS EV$/i},
  {maker:/^코리아에어카고$/i,name:'LSEV',targetFamilyId:'family-cac2d34215ac4947',force:true,re:/^LSEV$/i},
  {maker:/^한국지엠$/i,name:'파워프라자 라보 EV PEACE',targetFamilyId:'family-7a736d6571d6fd7d',force:true,re:/^파워프라자 라보 ev PEACE$/i},
  {maker:/^AD모터스$/i,name:'Change',targetFamilyId:'family-327d41d5ed75df91',force:true,re:/^Change$/i},
  {maker:/^Aston Martin$/i,name:'DBX707',targetFamilyId:'family-6be70514b638ee3e',force:true,re:/^DBX707$/i},
  {maker:/^Aston Martin$/i,name:'Valour',targetFamilyId:'family-30159272bfed8398',force:true,re:/^Valour$/i},
  {maker:/^BYD$/i,name:'T4K',targetFamilyId:'family-2b1f9a0e3783f765',force:true,re:/^T4K$/i},
  {maker:/^Cadillac$/i,name:'VISTIQ',targetFamilyId:'family-36978d5d34b15e7b',force:true,re:/^캐딜락 비스틱$/i},
  {maker:/^DFSK$/i,name:'C35S2',targetFamilyId:'family-a1b080a4eff28396',force:true,re:/^C35S2$/i},
  {maker:/^DFSK$/i,name:'C35S5',targetFamilyId:'family-136f3712dfdfa3a3',force:true,re:/^C35S5$/i},
  {maker:/^DFSK$/i,name:'K01H',targetFamilyId:'family-5758e475d76f9250',force:true,re:/^K01H$/i},
  {maker:/^DFSK$/i,name:'MASADA 카고',targetFamilyId:'family-f79bf789cbae012a',force:true,re:/^MASADA 카고$/i},
  {maker:/^DFSK$/i,name:'MASADA 픽업',targetFamilyId:'family-671094579b0b6265',force:true,re:/^MASADA 픽업$/i},
  {maker:/^DongfengLiuzhou$/i,name:'테라밴',targetFamilyId:'family-6aa35d39b955de6d',force:true,re:/^테라밴$/i},
  {maker:/^DongfengLiuzhou$/i,name:'테라밴키즈',targetFamilyId:'family-4612af2eaa51a4d8',force:true,re:/^테라밴키즈$/i},
  {maker:/^DongfengLiuzhou$/i,name:'테라밴키즈11',targetFamilyId:'family-6d28ece05be04993',force:true,re:/^테라밴키즈11$/i},
  {maker:/^Ferrari$/i,name:'12Cilindri',targetFamilyId:'family-59fbd764becffbe9',force:true,re:/^페라리 12칠린드리$/i},
  {maker:/^Ferrari$/i,name:'12Cilindri Spider',targetFamilyId:'family-6168c43ea6014080',force:true,re:/^페라리 12칠린드리 스파이더$/i},
  {maker:/^Ferrari$/i,name:'Amalfi',targetFamilyId:'family-f44b5b8edc2b6d88',force:true,re:/^페라리 아말피$/i},
  {maker:/^GM$/i,name:'GMC Acadia Denali',targetFamilyId:'family-8971748cb3762249',force:true,re:/^지엠씨 아카디아 드날리$/i},
  {maker:/^GM$/i,name:'GMC Canyon Denali',targetFamilyId:'family-3988acef15bfef9c',force:true,re:/^지엠씨 캐니언 드날리$/i},
  {maker:/^GM$/i,name:'GMC Canyon AT4X',targetFamilyId:'family-cae3aafbf34d7a06',force:true,re:/^지엠씨 캐니언 AT4x$/i},
  {maker:/^GM$/i,name:'GMC Hummer EV SUV',targetFamilyId:'family-fdc2c98fbb9dab44',force:true,re:/^지엠씨 허머 EV SUV$/i},
  {maker:/^GM$/i,name:'카마로',targetFamilyId:'family-a3f9b6958feb28fb',force:true,re:/^카마로$/i},
  {maker:/^Liaoning Lingyuan Linghe$/i,name:'브라보',targetFamilyId:'family-4c5e578e7efe8d90',force:true,re:/^브라보$/i},
  {maker:/^Liaoning Lingyuan Linghe$/i,name:'비바',targetFamilyId:'family-1b52cdfc64f72978',force:true,re:/^비바$/i},
  {maker:/^McLaren$/i,name:'GTS',targetFamilyId:'family-ff87c2f61f241fcb',force:true,re:/^GTS$/i},
  {maker:/^Mitsubishi$/i,name:'Lancer Evolution',targetFamilyId:'family-0c63da61068f09c0',force:true,re:/^렌서 에볼루션$/i},
  {maker:/^Newgonow Auto co\.Ltd$/i,name:'SW40',targetFamilyId:'family-307e304b0e4ce511',force:true,re:/^SW40$/i},
  {maker:/^Nissan$/i,name:'젤라',targetFamilyId:'family-d3c18df3ed1fa9a1',force:true,re:/^젤라$/i},
  {maker:/^Nissan$/i,name:'젤라 피이백',targetFamilyId:'family-2e3667089414a8cc',force:true,re:/^젤라 피이백$/i},
  {maker:/^Xiamen King Long United Industry Co\., Ltd\.$/i,name:'STEGO-Z',targetFamilyId:'family-5c6c2f403a4ac3f4',force:true,re:/^STEGO-Z$/i},
  {maker:/^기아$/i,name:'모하비',re:/^모하비(?:\s|\(|$)/i},
  {maker:/^기아$/i,name:'스팅어',re:/^스팅어(?:\s|\(|$)/i},
  {maker:/^기아$/i,name:'봉고',re:/^봉고(?:\s|\(|$)/i},
  {maker:/^기아$/i,name:'스토닉',re:/^스토닉(?:\s|\(|$)/i},
  {maker:/^기아$/i,name:'타스만',re:/^타스만(?:\s|\(|$)/i},
  {maker:/^기아$/i,name:'PV5',re:/^PV5(?:\s|\(|$)/i},
  {maker:/^기아$/i,canonicalMaker:'현대',makerId:'hyundai',targetFamilyId:'hyundai-staria',name:'스타리아',re:/^스타리아(?:\s|\(|$)/i},
  {maker:/^기아$/i,name:'K3',re:/^K3(?:\s|$)/i},
  {maker:/^기아$/i,name:'K7',targetFamilyId:'family-b7795a18ef806e42',force:true,re:/^K7(?:\s|\(|$)/i},
  {maker:/^현대$/i,name:'그랜드 스타렉스',re:/^그랜드\s*스타렉스(?:\s|\(|$)/i},
  {maker:/^현대$/i,name:'포터',re:/^포터(?:\s|\(|일렉트릭|\d|$)/i},
  {maker:/^현대$/i,name:'벨로스터',re:/^벨로스터(?:\s|\(|$)/i},
  {maker:/^현대$/i,name:'i30',re:/^i30(?:\s|\(|$)/i},
  {maker:/^현대$/i,name:'아슬란',re:/^아슬란(?:\s|\(|$)/i},
  {maker:/^현대$/i,name:'아이오닉',re:/^아이오닉(?!\s*[569])(?:\s|\(|$)/i},
  {maker:/^루트17$/i,name:'다니고3 픽업',targetFamilyId:'family-77881647c0d9d555',force:true,re:/^(?:다니고3픽업(?:\(DANIGO\s*3\s*PICK\s*UP\))?|DANIGO\s*3)$/i},
  {maker:/^루트17$/i,name:'다니고C',targetFamilyId:'family-7ef9f5ae593ff6a1',force:true,re:/^다니고C$/i},
  {maker:/^루트17$/i,name:'다니고C2',targetFamilyId:'family-c4019f2942b153e5',force:true,re:/^다니고C2$/i},
  {maker:/^루트17$/i,name:'다니고 VAN',targetFamilyId:'family-74b4bfdf928cf264',force:true,re:/^다니고VAN$/i},
  {maker:/^루트17$/i,name:'다니고',targetFamilyId:'family-687fc5d033b90b02',force:true,re:/^Danigo\s*\(다니고\)$/i},
  {maker:/^(?:캠시스|쎄보모빌리티|Supaq Limited)$/i,canonicalMaker:'쎄보모빌리티',makerId:'cevo-mobility',name:'CEVO-C',targetFamilyId:'family-23e3eb5656c2da44',force:true,re:/^CEVO-C(?:\s+SE(?:\s+1인승\s+밴형)?)?$/i},
  {maker:/^Maserati$/i,name:'MCPURA',targetFamilyId:'family-029cb9278f613b0b',force:true,re:/^Maserati\s+MCPURA(?:\s+Cielo)?$/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'렉스턴 스포츠 칸',re:/^렉스턴\s*스포츠\s*칸(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'렉스턴 스포츠',re:/^렉스턴\s*스포츠(?!\s*칸)(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'렉스턴',re:/^(?:G4\s*)?렉스턴(?!\s*스포츠)(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'무쏘 그랜드',re:/^무쏘\s*그랜드(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'무쏘 스포츠',re:/^무쏘\s*스포츠(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'무쏘 칸',re:/^무쏘\s*칸(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'무쏘',re:/^무쏘(?!\s*(?:그랜드|스포츠|칸))(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'토레스 EVX',re:/^토레스\s*EVX(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'토레스',re:/^토레스(?!\s*EVX)(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'코란도 e-Motion',re:/^코란도\s*(?:e[- ]?motion|이모션)(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'코란도',re:/^코란도(?!\s*(?:e[- ]?motion|이모션))(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'티볼리 에어',re:/^티볼리\s*에어(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'티볼리',re:/^티볼리(?!\s*에어)(?:\s|$)/i},
  {maker:/^(?:케이지모빌리티|KG Mobility)$/i,name:'액티언',re:/^액티언(?:\s|$)/i},
  {maker:/^Audi$/i,name:'SQ5',re:/^(?:AUDI\s*)?SQ5(?:\s|$)/i},
  {maker:/^Audi$/i,name:'SQ7',re:/^(?:AUDI\s*)?SQ7(?:\s|$)/i},
  {maker:/^DS$/i,name:'DS3',re:/^DS\s*3(?:\s|$)/i},
  {maker:/^DS$/i,name:'DS4',re:/^DS\s*4(?:\s|$)/i},
  {maker:/^DS$/i,name:'DS7',re:/^DS\s*7(?:\s|$)/i},
  {maker:/^Infiniti$/i,name:'Q50',re:/^(?:INFINITI\s*)?Q50(?:\s|$)/i},
  {maker:/^Infiniti$/i,name:'Q60',re:/^(?:INFINITI\s*)?Q60(?:\s|$)/i},
  {maker:/^Infiniti$/i,name:'QX50',re:/^(?:INFINITI\s*)?QX50(?:\s|$)/i},
  {maker:/^Infiniti$/i,name:'QX60',re:/^(?:INFINITI\s*)?QX60(?:\s|$)/i},
  {maker:/^Renault Korea$/i,name:'Grand Koleos',re:/^(?:그랑\s*)?콜레오스(?:\s|$)/i},
  {maker:/^Renault Korea$/i,name:'Scenic E-Tech',re:/^SCENIC(?:\s|_|$)/i},
  {maker:/^Renault Korea$/i,name:'필랑트',targetFamilyId:'family-95e04f019efe5543',force:true,re:/^FILANTE(?:\s|_|$)/i},
  {maker:/^샹하이완샹오토모바일$/i,name:'썬라이즈-T01',targetFamilyId:'family-8d3882140bdd3710',force:true,re:/^썬라이즈-T01$/i},
  {maker:/^지리쓰촨상용차$/i,name:'SE-A2 밴',targetFamilyId:'family-de87612d1b59fa5b',force:true,re:/^SE-A2밴$/i},
  {maker:/^Shanxi Victory Manufacturing Co\., LTD$/i,name:'E-CV1',targetFamilyId:'family-07f30bf92f1879bd',force:true,re:/^E-CV1$/i},
  {maker:/^Shanxi Victory Manufacturing Co\., LTD$/i,name:'E-CV1 5VAN',targetFamilyId:'family-660e315305688876',force:true,re:/^E-CV1\s*5VAN$/i},
  {maker:/^이엔플러스$/i,name:'이엔 1톤 롱바디 카고',targetFamilyId:'family-ff3a1762ee041708',force:true,re:/^이엔1톤롱바디카고$/i},
  {maker:/^이엔플러스$/i,name:'EV 1톤 롱바디 트럭',targetFamilyId:'family-d0f2f3b10047d557',force:true,re:/^이엔플러스EV1톤롱바디트럭$/i},
  {maker:/^제인모터스$/i,name:'칼마토 EV 1톤 내장탑차',targetFamilyId:'family-d0e36b23bacf0759',force:true,re:/^제인모터스칼마토EV1톤내장탑차$/i},
  {maker:/^한국쓰리축$/i,name:'1톤 ST1 트럭',targetFamilyId:'family-09a33e2a05d74414',force:true,re:/^한국쓰리축1톤ST1트럭$/i},
  {maker:/^한국쓰리축$/i,name:'1톤 롱바디 EV 트럭',targetFamilyId:'family-cc1d82feb2f724cf',force:true,re:/^한국쓰리축1톤롱바디EV트럭\((?:봉고|포터)\)$/i},
  {maker:/^현대$/i,name:'엠티알 ST1 승합자동차',targetFamilyId:'family-133a10cc6cb5a74e',force:true,re:/^엠티알ST1승합자동차$/i},
  {maker:/^현대$/i,name:'엠티알 ST1 어린이운송승합차',targetFamilyId:'family-2e3b5259b6270e91',force:true,re:/^엠티알ST1어린이운송승합차$/i},
  {maker:/^현대$/i,name:'한국상용 0.9톤 롱바디 EV 내장탑트럭',targetFamilyId:'family-553265042c01e92a',force:true,re:/^한국상용0\.9톤롱바디EV내장탑트럭$/i},
  {maker:/^현대$/i,name:'한국상용 1톤 롱바디 EV 트럭',targetFamilyId:'family-6eb756d7aac329fb',force:true,re:/^한국상용1톤롱바디EV트럭$/i},
  {maker:/^한국지엠$/i,name:'스파크',re:/^스파크(?:\s|$)/i},
  {maker:/^한국지엠$/i,name:'트랙스',re:/^트랙스(?:\s|$)/i},
  {maker:/^한국지엠$/i,name:'말리부',re:/^말리부(?:\s|$)/i},
  {maker:/^한국지엠$/i,name:'트레일블레이저',re:/^트레일블레이저(?:\s|$)/i},
  {maker:/^한국지엠$/i,name:'다마스',re:/^다마스(?:\s|밴|$)/i},
  {maker:/^한국지엠$/i,name:'라보',re:/^라보(?:\s|\d|롱|$)/i},
  {maker:/^Mercedes-Benz$/i,name:'AMG GT',re:/^(?:MERCEDES|MERCEDCES)[- ]?AMG\s+GT\s*[- ]?[CR]?\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQC',re:/^(?:(?:MERCEDES[- ]?BENZ|벤츠)\s*)?EQC\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQA',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?EQA\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQB',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?EQB\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQE',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?EQE\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQS',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?EQS\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLA',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?GLA\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLB',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?GLB\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLC',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?GLC\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLE',re:/^(?:(?:MERCEDES[- ]?(?:BENZ|AMG)|벤츠)\s*)?GLE\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLS',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG|MAYBACH)\s*)?GLS\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'CLA',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?CLA\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'CLS',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?CLS\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'CLE',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?CLE\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'SLC',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?SLC\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'SL',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG|MAYBACH)\s*)?SL\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'A-Class',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?A\s*\d{2,3}[a-z]?(?=\s|\(|$)/i},
  {maker:/^Mercedes-Benz$/i,name:'C-Class',re:/^(?:(?:MERCEDES|MERCEDCES)[- ]?(?:BENZ|AMG)\s*)?C\s*\d{2,3}[a-z]?(?=\s|\(|$)/i},
  {maker:/^Mercedes-Benz$/i,name:'E-Class',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?E\s*\d{2,3}[a-z]?(?=\s|\(|$)/i},
  {maker:/^Mercedes-Benz$/i,name:'S-Class',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG|MAYBACH)\s*)?S\s*\d{2,3}[a-z]?(?=\s|\(|$)/i},
  {maker:/^Mercedes-Benz$/i,name:'G-Class',re:/^(?:MERCEDES[- ]?(?:BENZ|AMG)\s*)?G\s*\d{2,3}[a-z]?(?=\s|\(|$)/i},
  {maker:/^Mercedes-Benz$/i,name:'EQA',re:/MERCEDES[- ]?BENZ\s*EQA\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQB',re:/MERCEDES[- ]?BENZ\s*EQB\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQE',re:/MERCEDES[- ]?BENZ\s*EQE\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQS',re:/MERCEDES[- ]?BENZ\s*EQS\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLA',re:/MERCEDES[- ]?BENZ\s*GLA\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLB',re:/MERCEDES[- ]?BENZ\s*GLB\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLC',re:/MERCEDES[- ]?BENZ\s*GLC\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLE',re:/MERCEDES[- ]?BENZ\s*GLE\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLS',re:/MERCEDES[- ]?BENZ\s*GLS\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'CLA',re:/MERCEDES[- ]?BENZ\s*CLA\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'CLS',re:/MERCEDES[- ]?BENZ\s*CLS\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'CLE',re:/MERCEDES[- ]?BENZ\s*CLE\s*\d*/i},
  {maker:/^Porsche$/i,name:'718',re:/^(?:포르쉐\s*)?(?:박스터|카이맨)(?:\s|$)/i},
  {maker:/^Nissan$/i,name:'Maxima',re:/^(?:NISSAN\s*)?MAXIMA(?:\s|$)/i},
  {maker:/^Mitsubishi$/i,name:'L200',re:/^L200(?:\s|$)/i},
  {maker:/^Maserati$/i,name:'GranCabrio',re:/그란카브리오|GRAN\s*CABRIO/i},
  {maker:/^(?:Chrysler|크라이슬러)$/i,name:'200',re:/^200(?:\s|$)/i}
];

function classify(r){
  const s=String(r.model||'').toUpperCase(),cc=Number(r.displacement_cc),range=Number(r.range_km);
  if(/수소|FCEV|HYDROGEN/.test(s))return'hydrogen';
  if(/PHEV|PLUG[- ]?IN|플러그인/.test(s))return'phev';
  if(/하이브리드|HYBRID|\bHEV\b/.test(s))return'hybrid';
  if(/일렉트릭|ELECTRIC|\bBEV\b|\bEV(?=\d|\b)/.test(s))return'electric';
  if(/LPG|LPI|엘피지/.test(s))return'lpg';
  if(/경유|디젤|DIESEL|\bTDI\b|\bCRDI\b|\bD[- ]?CI\b|BLUEHDI|\bHDI\b|\bCDI\b/.test(s))return'diesel';
  if(/휘발유|가솔린|GASOLINE|PETROL|T-?GDI|\bGDI\b|\bMPI\b|\bTSI\b|\bTFSI\b|ECOBOOST/.test(s))return'gasoline';
  if(Number.isFinite(range)&&range>0&&cc===0)return'electric';
  if(Number.isFinite(range)&&range>0&&Number.isFinite(cc)&&cc>0)return'phev';
  return'unknown';
}
function calcReady(r,p){
  if(!/승용/.test(String(r.vehicle_class||'')))return false;
  if(p==='electric')return Number(r.combined_efficiency)>0;
  return Number(r.displacement_cc)>0&&Number(r.combined_efficiency)>0;
}

const groups=new Map((c.groups||[]).map(g=>[g.catalog_id,g]));
const sourceFamilyById=new Map((h.families||[]).map(f=>[f.family_id,f]));
const updatedIndex={};let changed=0;
for(const [id,gi0] of Object.entries(h.group_index||{})){
  const g=groups.get(id);if(!g){updatedIndex[id]=gi0;continue}
  let gi={...gi0};
  const rule=RULES.find(r=>r.maker.test(String(gi.maker||''))&&r.re.test(String(g.model||'')));
  if(rule&&(gi.normalization_status!=='reviewed_override'||rule.force)){
      const maker=rule.canonicalMaker||gi.maker,makerId=rule.makerId||gi.maker_id||key(maker),familyId=rule.targetFamilyId||stable('family',`${makerId}|${key(rule.name)}`);
      if(gi.family_id!==familyId||gi.family_name!==rule.name||gi.normalization_status!=='auto_high')changed++;
      gi={...gi,maker_id:makerId,maker,family_id:familyId,family_name:rule.name,normalization_status:'auto_high',confidence:Math.max(.96,Number(gi.confidence)||0),generation_id:stable('gen',`${familyId}|${key(gi.generation_label)||'unspecified'}`)};
  }
  updatedIndex[id]=gi;
}

// Preserve old query links when former families collapse into one public model.
// Ambiguous splits deliberately receive no redirect.
const aliasTargets=new Map();
for(const [id,gi] of Object.entries(updatedIndex)){
  const previous=(h.group_index||{})[id]?.family_id;
  if(!previous)continue;
  if(!aliasTargets.has(previous))aliasTargets.set(previous,new Set());
  aliasTargets.get(previous).add(gi.family_id);
}
const familyAliases={...(h.family_aliases||{})};
for(const [previous,targets] of aliasTargets){
  if(targets.size!==1)continue;
  const [target]=targets;
  if(previous!==target)familyAliases[previous]=target;
}

const buckets=new Map();
const statusPriority={reviewed_override:4,auto_high:3,auto_medium:2,raw_only:1};
for(const [id,gi] of Object.entries(updatedIndex)){
  const g=groups.get(id);if(!g)continue;
  const old=sourceFamilyById.get((h.group_index||{})[id]?.family_id);
  if(!buckets.has(gi.family_id))buckets.set(gi.family_id,{family_id:gi.family_id,maker_id:gi.maker_id,maker:gi.maker,family_name:gi.family_name,category:gi.normalization_status==='reviewed_override'?old?.category||null:null,normalization_status:gi.normalization_status,confidence:gi.confidence,reviewed_family_id:gi.normalization_status==='reviewed_override'?old?.reviewed_family_id||null:null,source_status:'active',raw_group_ids:[],raw_models:[],raw_makers:[],gen:new Map(),pt:new Map(),record_count:0,active_record_count:0,archived_record_count:0,calculator_ready_record_count:0,reviewed_detail_paths:new Set()});
  const f=buckets.get(gi.family_id);if((statusPriority[gi.normalization_status]||0)>(statusPriority[f.normalization_status]||0)){f.normalization_status=gi.normalization_status;f.confidence=gi.confidence;f.reviewed_family_id=old?.reviewed_family_id||f.reviewed_family_id;f.category=old?.category||f.category}f.raw_group_ids.push(id);f.raw_models.push(g.model);f.raw_makers.push(...(g.source_makers||[]),g.maker);if(g.reviewed_detail_path)f.reviewed_detail_paths.add(g.reviewed_detail_path);if(g.source_status!=='active')f.source_status=f.source_status==='active'?'mixed':g.source_status;
  const gl=gi.generation_label||'세대 미분류',gk=`${gi.family_id}|${key(gl)||'unspecified'}`;
  if(!f.gen.has(gk))f.gen.set(gk,{generation_id:stable('gen',gk),family_id:gi.family_id,generation_label:gl,generation_code:gl==='세대 미분류'?null:gl,normalization_source:gl==='세대 미분류'?'unspecified':'source_or_reviewed',confidence:gi.confidence,raw_group_ids:[],raw_models:[],record_count:0,active_record_count:0,calculator_ready_record_count:0,pt:new Map()});
  const ge=f.gen.get(gk);ge.raw_group_ids.push(id);ge.raw_models.push(g.model);
  for(const r of g.records||[]){const p=classify(r);f.pt.set(p,(f.pt.get(p)||0)+1);ge.pt.set(p,(ge.pt.get(p)||0)+1);f.record_count++;ge.record_count++;if(g.source_status==='active'){f.active_record_count++;ge.active_record_count++}else f.archived_record_count++;if(calcReady(r,p)){f.calculator_ready_record_count++;ge.calculator_ready_record_count++}}
}
const families=[...buckets.values()].map(f=>({family_id:f.family_id,maker_id:f.maker_id,maker:f.maker,family_name:f.family_name,category:f.category,normalization_status:f.normalization_status,confidence:f.confidence,reviewed_family_id:f.reviewed_family_id,source_status:f.source_status,raw_group_count:f.raw_group_ids.length,raw_group_ids:uniq(f.raw_group_ids),raw_models:uniq(f.raw_models).sort(sortKo).slice(0,80),raw_makers:uniq(f.raw_makers).sort(sortKo),generation_count:f.gen.size,generations:[...f.gen.values()].map(g=>({generation_id:g.generation_id,family_id:g.family_id,generation_label:g.generation_label,generation_code:g.generation_code,normalization_source:g.normalization_source,confidence:g.confidence,raw_group_count:g.raw_group_ids.length,raw_group_ids:uniq(g.raw_group_ids),raw_models:uniq(g.raw_models).sort(sortKo).slice(0,80),record_count:g.record_count,active_record_count:g.active_record_count,calculator_ready_record_count:g.calculator_ready_record_count,powertrains:[...g.pt.entries()].map(([powertrain,count])=>({powertrain,count})).sort((a,b)=>b.count-a.count)})).sort((a,b)=>(a.generation_label==='세대 미분류')-(b.generation_label==='세대 미분류')||sortKo(a.generation_label,b.generation_label)),powertrains:[...f.pt.entries()].map(([powertrain,count])=>({powertrain,count})).sort((a,b)=>b.count-a.count),record_count:f.record_count,active_record_count:f.active_record_count,archived_record_count:f.archived_record_count,calculator_ready_record_count:f.calculator_ready_record_count,reviewed_detail_paths:[...f.reviewed_detail_paths]})).sort((a,b)=>sortKo(a.maker,b.maker)||sortKo(a.family_name,b.family_name));
const makerMap=new Map();for(const f of families){if(!makerMap.has(f.maker_id))makerMap.set(f.maker_id,{maker_id:f.maker_id,maker:f.maker,family_ids:[],active_family_count:0,active_record_count:0});const m=makerMap.get(f.maker_id);m.family_ids.push(f.family_id);if(f.active_record_count>0)m.active_family_count++;m.active_record_count+=f.active_record_count}
const makers=[...makerMap.values()].map(m=>({...m,family_count:m.family_ids.length})).sort((a,b)=>b.active_record_count-a.active_record_count||sortKo(a.maker,b.maker));
const active=families.filter(f=>f.active_record_count>0);
h.hierarchy_version=Math.max(3,Number(h.hierarchy_version)||0);h.generated_at=new Date().toISOString();h.active_maker_count=makers.filter(m=>m.active_record_count>0).length;h.active_family_count=active.length;h.active_generation_count=active.reduce((n,f)=>n+f.generations.filter(g=>g.active_record_count>0).length,0);h.calculator_ready_record_count=active.reduce((n,f)=>n+f.calculator_ready_record_count,0);h.normalization={reviewed_families:active.filter(f=>f.normalization_status==='reviewed_override').length,auto_high_families:active.filter(f=>f.normalization_status==='auto_high').length,auto_medium_families:active.filter(f=>f.normalization_status==='auto_medium').length,raw_only_families:active.filter(f=>f.normalization_status==='raw_only').length,reviewed_groups:Object.values(updatedIndex).filter(g=>g.source_status==='active'&&g.normalization_status==='reviewed_override').length,auto_high_groups:Object.values(updatedIndex).filter(g=>g.source_status==='active'&&g.normalization_status==='auto_high').length,auto_medium_groups:Object.values(updatedIndex).filter(g=>g.source_status==='active'&&g.normalization_status==='auto_medium').length,raw_only_groups:Object.values(updatedIndex).filter(g=>g.source_status==='active'&&g.normalization_status==='raw_only').length};h.policy+=' Backlog refinement applies only explicit maker/model aliases; source records and catalog IDs are unchanged.';h.makers=makers;h.families=families;h.family_aliases=familyAliases;h.group_index=updatedIndex;
fs.writeFileSync(hierarchyPath,JSON.stringify(h,null,2)+'\n');
console.log(`Hierarchy backlog refinement: ${changed} raw groups relabeled / ${h.active_family_count} families / raw-only ${h.normalization.raw_only_families}`);

await import('./apply-reviewed-names.mjs');
