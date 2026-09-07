(function(root){
 function tax(v){return root.CAR_COST_MATH.annualTax(v.cc,false,'2026-01',2026)?.total??null}
 function annual(v,km,price){const energy=root.CAR_COST_MATH.energyCost(km,v.combined,price),t=tax(v);return energy==null||t==null?null:{energy,tax:t,total:energy+t}}
 function compare(a,b,km,price){const x=annual(a,km,price),y=annual(b,km,price);if(!x||!y)return null;return{a:x,b:y,saving:x.total-y.total}}
 function payback(a,b,km,price,gap){const c=compare(a,b,km,price);if(!c||!Number.isFinite(gap))return null;return{...c,years:gap<=0?0:c.saving>0?gap/c.saving:null,gap}}
 root.CAR_DECISION_MATH={annual,compare,payback};
})(globalThis);
