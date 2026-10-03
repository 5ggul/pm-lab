import { previewFixtureEnabled } from "@/lib/history";
export default function FixtureBanner(){if(!previewFixtureEnabled())return null;return <div className="fixture-banner" role="status"><strong>PREVIEW FIXTURE</strong> 차트·증감·급상승 계산에 개발용 과거 시계열이 사용됩니다. 현재값은 Roblox 공개 API를 우선하며, Fixture는 운영 데이터로 사용하지 않습니다.</div>}
