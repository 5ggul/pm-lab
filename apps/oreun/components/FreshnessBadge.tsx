import type { FreshnessState } from "@/lib/types";
export default function FreshnessBadge({state}:{state:FreshnessState}){const label={fresh:"정상 갱신",delayed:"갱신 지연",stale:"오래된 데이터",unavailable:"데이터 없음",insufficient_data:"수집 중"}[state];return <span className={`freshness ${state}`}>{label}</span>}
