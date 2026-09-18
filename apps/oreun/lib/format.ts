export function compactNumber(value: number | null): string {
  if (value == null) return "—";
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(value >= 1_000_000_000 ? 1 : 0)}억`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 1 : 0)}만`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}천`;
  return value.toLocaleString("ko-KR");
}
export function pct(value: number | null): string { if (value == null) return "—"; const n=value*100; return `${n>0?"▲":n<0?"▼":""}${Math.abs(n).toFixed(1)}%`; }
export function relativeTime(iso: string | null, now = new Date()): string {
  if (!iso) return "확인 시각 없음";
  const diff=Math.max(0, now.getTime()-new Date(iso).getTime()); const m=Math.floor(diff/60000);
  if (m<1) return "방금 전"; if(m<60)return `${m}분 전`; const h=Math.floor(m/60); if(h<24)return `${h}시간 전`; const d=Math.floor(h/24); return d===1?"어제":`${d}일 전`;
}
