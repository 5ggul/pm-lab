export function comparisonLabel(model,fuel){
 const label={gasoline:'가솔린',hybrid:'하이브리드',electric:'전기차',ev:'전기차',diesel:'디젤',lpg:'LPG'}[fuel];
 if(!label)throw Error('Unknown comparison fuel: '+fuel);
 return `${model} ${label}`;
}
