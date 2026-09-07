export const BRAND_SLUGS = Object.freeze({
  '메가MGC커피':'mega-mgc-coffee','컴포즈커피':'compose-coffee','빽다방':'paiks-coffee','이디야커피':'ediya-coffee','더벤티':'the-venti',
  '매머드커피':'mammoth-coffee','하삼동커피':'hasamdong-coffee','텐퍼센트커피':'tenpercent-coffee','커피베이':'coffee-bay','카페봄봄':'cafe-bombom',
  '교촌치킨':'kyochon-chicken','bhc치킨':'bhc-chicken','BBQ치킨':'bbq-chicken','굽네치킨':'goobne-chicken','네네치킨':'nene-chicken',
  '처갓집양념치킨':'cheogajip-chicken','자담치킨':'jadam-chicken','노랑통닭':'norang-tongdak',
  '맘스터치':'momstouch','프랭크버거':'frank-burger','롯데리아':'lotteria','노브랜드버거':'no-brand-burger',
  '김가네':'gimgane','얌샘김밥':'yamsaem-gimbap','바르다김선생':'barda-kim-seonsaeng','신전떡볶이':'sinjeon-tteokbokki','청년다방':'cheongnyeon-dabang','두끼':'dookki',
  '한솥':'hansot','본죽&비빔밥':'bonjuk-bibimbap','원할머니보쌈':'wonhalmoney-bossam','놀부부대찌개':'nolboo-budaejjigae','오봉집':'obongjip','두찜':'dujjim',
  '파리바게뜨':'paris-baguette','뚜레쥬르':'tous-les-jours','배스킨라빈스':'baskin-robbins','설빙':'sulbing','디저트39':'dessert39',
  'CU':'cu','GS25':'gs25','세븐일레븐':'seven-eleven'
});

export const SUBPAGE_PREVIEW_BRANDS = Object.freeze([
  '메가MGC커피','컴포즈커피','빽다방','이디야커피','교촌치킨','bhc치킨','BBQ치킨','굽네치킨','맘스터치','프랭크버거'
]);

export const SUBPAGE_QUALITY_RULES = Object.freeze({
  cost:{minYears:3,minComponents:4,requiresSource:true,requiresReferenceYear:true},
  stores:{minYears:3,requiresOpenClose:true,requiresSource:true,requiresReferenceYear:true}
});

export const OFFICIAL_LINKS = Object.freeze({
  franchise:{label:'공정위 가맹사업정보제공시스템',href:'https://franchise.ftc.go.kr/'},
  ftc:{label:'공정거래위원회',href:'https://www.ftc.go.kr/'},
  data:{label:'공공데이터포털',href:'https://www.data.go.kr/'}
});

export const GUIDE_RELATIONS = Object.freeze({
  'how-to-read-franchise-disclosure':{brands:['메가MGC커피','교촌치킨','맘스터치'],tools:['disclosure-decoder','open-close-rate'],guides:['how-to-read-open-close-store-counts','franchise-contract-checklist'],official:['franchise','ftc']},
  'franchise-fee-interior-deposit-difference':{brands:['메가MGC커피','컴포즈커피','교촌치킨'],tools:['startup-cost','disclosure-decoder'],guides:['why-rent-deposit-is-not-in-startup-cost','why-key-money-is-not-public-cost'],official:['franchise']},
  'why-rent-deposit-is-not-in-startup-cost':{brands:['메가MGC커피','맘스터치','한솥'],tools:['startup-cost','monthly-fixed-cost'],guides:['franchise-fee-interior-deposit-difference','why-key-money-is-not-public-cost'],official:['franchise']},
  'how-to-read-open-close-store-counts':{brands:['메가MGC커피','bhc치킨','맘스터치'],tools:['open-close-rate','category-median'],guides:['many-stores-do-not-mean-profit','how-to-read-franchise-disclosure'],official:['franchise','data']},
  'many-stores-do-not-mean-profit':{brands:['메가MGC커피','교촌치킨','CU'],tools:['category-median','brand-filter'],guides:['how-to-read-open-close-store-counts','do-not-copy-headquarters-expected-sales'],official:['franchise']},
  'low-price-coffee-comparison-checklist':{brands:['메가MGC커피','컴포즈커피','매머드커피'],tools:['startup-cost','brand-filter'],guides:['franchise-fee-interior-deposit-difference','store-density-is-not-sales'],official:['franchise','data']},
  'chicken-franchise-cost-comparison':{brands:['교촌치킨','bhc치킨','BBQ치킨'],tools:['startup-cost','monthly-fixed-cost'],guides:['franchise-fee-interior-deposit-difference','royalty-mandatory-purchase-fixed-cost'],official:['franchise']},
  'royalty-mandatory-purchase-fixed-cost':{brands:['교촌치킨','맘스터치','한솥'],tools:['monthly-fixed-cost','break-even'],guides:['why-break-even-calculation-goes-wrong','franchise-contract-checklist'],official:['franchise']},
  'why-break-even-calculation-goes-wrong':{brands:['메가MGC커피','교촌치킨','맘스터치'],tools:['break-even','monthly-fixed-cost'],guides:['royalty-mandatory-purchase-fixed-cost','do-not-copy-headquarters-expected-sales'],official:['franchise']},
  'store-density-is-not-sales':{brands:['메가MGC커피','컴포즈커피','CU'],tools:['store-density','brand-filter'],guides:['how-to-read-regional-brand-store-count','many-stores-do-not-mean-profit'],official:['data']},
  'do-not-copy-headquarters-expected-sales':{brands:['메가MGC커피','교촌치킨','맘스터치'],tools:['break-even','monthly-fixed-cost'],guides:['many-stores-do-not-mean-profit','why-break-even-calculation-goes-wrong'],official:['franchise','ftc']},
  'franchise-contract-checklist':{brands:['교촌치킨','맘스터치','한솥'],tools:['disclosure-decoder','startup-cost'],guides:['how-to-read-franchise-disclosure','royalty-mandatory-purchase-fixed-cost'],official:['franchise','ftc']},
  'why-our-number-differs-from-ftc':{brands:['메가MGC커피','교촌치킨','CU'],tools:['category-median','open-close-rate'],guides:['how-to-read-franchise-disclosure','how-to-read-open-close-store-counts'],official:['franchise','data']},
  'why-key-money-is-not-public-cost':{brands:['메가MGC커피','맘스터치','한솥'],tools:['startup-cost','monthly-fixed-cost'],guides:['why-rent-deposit-is-not-in-startup-cost','franchise-fee-interior-deposit-difference'],official:['franchise']},
  'how-to-read-regional-brand-store-count':{brands:['메가MGC커피','교촌치킨','CU'],tools:['store-density','brand-filter'],guides:['store-density-is-not-sales','why-our-number-differs-from-ftc'],official:['franchise','data']}
});

export const TOOL_SLUG_RENAMES = Object.freeze({'candidate-finder':'brand-filter'});
