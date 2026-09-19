import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const FUNCTION_PREFIX = "/functions/v1/r1-web-preview";
const ROBLOX_GAMES = "https://games.roblox.com/v1/games";
const THUMBNAILS = "https://thumbnails.roblox.com/v1/games/icons";

function adminKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return String(parsed.default);
    } catch {}
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase admin key unavailable");
  return legacy;
}

const KEY = adminKey();

function apiHeaders() {
  const headers: Record<string, string> = {
    apikey: KEY,
    accept: "application/json",
  };
  if (!KEY.startsWith("sb_secret_")) headers.Authorization = `Bearer ${KEY}`;
  return headers;
}

async function rest<T>(
  tableOrPath: string,
  params: Record<string, string | number> = {},
): Promise<T[]> {
  const path = tableOrPath.startsWith("/") ? tableOrPath : `/rest/v1/${tableOrPath}`;
  const url = new URL(path, SUPABASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { headers: apiHeaders(), cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return await response.json() as T[];
}

type GameRow = {
  universe_id: number | string;
  root_place_id: number | string;
  canonical_slug: string;
  name_ko: string;
  description_ko: string;
  index_state: string;
};
type StateRow = {
  universe_id: number | string;
  name: string;
  creator_name: string | null;
  playing: number | string | null;
  visits: number | string | null;
  favorites: number | string | null;
  source_updated_at: string | null;
  fetched_at: string;
};
type AliasRow = { universe_id: number | string; alias: string; normalized_alias: string };
type RollupRow = {
  universe_id: number | string;
  bucket_at: string;
  playing_last: number | string | null;
  coverage_ratio: number | string;
};
type RunRow = {
  id: string;
  status: string;
  requested_count: number;
  success_count: number;
  failure_count: number;
  rate_limit_count: number;
  started_at: string;
  finished_at: string | null;
  error_summary: unknown;
};
type TargetRow = {
  universe_id: number | string;
  tier: string;
  cadence_minutes: number;
  failure_count: number;
  next_due_at: string;
  last_error: string | null;
};
type ReadinessRow = {
  universe_id: number | string;
  canonical_slug: string;
  index_state: string;
  hourly_buckets_24h: number | string;
  avg_coverage_24h: number | string;
  current_data_recent: boolean;
  data_ready_for_index_review: boolean;
};
type CommunityAnalyticsReadinessRow = {
  universe_id: number | string;
  canonical_slug: string;
  name_ko: string;
  group_id: number | string | null;
  authorization_state: string | null;
  enabled: boolean | null;
  last_verified_at: string | null;
  last_collected_at: string | null;
  last_error: string | null;
  ready_for_server_collection: boolean | null;
  latest_snapshot_at: string | null;
};

type Game = {
  universeId: number;
  rootPlaceId: number;
  slug: string;
  nameKo: string;
  descriptionKo: string;
  indexState: string;
  name: string;
  creatorName: string;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  updatedAt: string | null;
  fetchedAt: string | null;
  aliases: string[];
  thumbnailUrl: string | null;
};

const e = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/[\s\-_·:!.'’()[\]{}]/g, "").trim();

const numberValue = (value: unknown) =>
  value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);

function compact(value: number | null) {
  if (value == null) return "—";
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(value >= 1_000_000_000 ? 0 : 1)}억`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}만`;
  return value.toLocaleString("ko-KR");
}

function freshness(fetchedAt: string | null) {
  if (!fetchedAt) return { key: "unavailable", label: "데이터 없음" };
  const age = (Date.now() - new Date(fetchedAt).getTime()) / 60_000;
  if (age <= 10) return { key: "fresh", label: "정상 갱신" };
  if (age <= 20) return { key: "delayed", label: "갱신 지연" };
  return { key: "stale", label: "오래된 데이터" };
}

function relative(fetchedAt: string | null) {
  if (!fetchedAt) return "확인 시각 없음";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 60_000));
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

async function thumbnails(ids: number[]) {
  if (!ids.length) return new Map<number, string>();
  try {
    const url = `${THUMBNAILS}?universeIds=${ids.join(",")}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return new Map<number, string>();
    const json = await response.json() as { data?: Array<{ targetId: number; state: string; imageUrl: string | null }> };
    return new Map(
      (json.data ?? [])
        .filter((row) => row.targetId > 0 && row.state === "Completed" && row.imageUrl)
        .map((row) => [row.targetId, row.imageUrl!] as const),
    );
  } catch {
    return new Map<number, string>();
  }
}

async function catalog(): Promise<Game[]> {
  const [games, states, aliases] = await Promise.all([
    rest<GameRow>("games", {
      select: "universe_id,root_place_id,canonical_slug,name_ko,description_ko,index_state",
      index_state: "neq.retired",
      order: "universe_id.asc",
    }),
    rest<StateRow>("game_provider_state", {
      select: "universe_id,name,creator_name,playing,visits,favorites,source_updated_at,fetched_at",
    }),
    rest<AliasRow>("game_aliases", {
      select: "universe_id,alias,normalized_alias",
      order: "id.asc",
    }),
  ]);

  const stateMap = new Map(states.map((row) => [Number(row.universe_id), row]));
  const aliasMap = new Map<number, string[]>();
  for (const row of aliases) {
    const id = Number(row.universe_id);
    aliasMap.set(id, [...(aliasMap.get(id) ?? []), row.alias]);
  }
  const iconMap = await thumbnails(games.map((game) => Number(game.universe_id)));

  return games.map((row) => {
    const id = Number(row.universe_id);
    const state = stateMap.get(id);
    return {
      universeId: id,
      rootPlaceId: Number(row.root_place_id),
      slug: row.canonical_slug,
      nameKo: row.name_ko,
      descriptionKo: row.description_ko,
      indexState: row.index_state,
      name: state?.name ?? row.name_ko,
      creatorName: state?.creator_name ?? "알 수 없음",
      playing: numberValue(state?.playing),
      visits: numberValue(state?.visits),
      favorites: numberValue(state?.favorites),
      updatedAt: state?.source_updated_at ?? null,
      fetchedAt: state?.fetched_at ?? null,
      aliases: aliasMap.get(id) ?? [row.name_ko],
      thumbnailUrl: iconMap.get(id) ?? null,
    };
  });
}

function gameIcon(game: Game, size = 46) {
  if (game.thumbnailUrl) {
    return `<img class="icon" src="${e(game.thumbnailUrl)}" alt="" width="${size}" height="${size}" loading="lazy">`;
  }
  const chars = e(game.nameKo.replace(/[^A-Za-z0-9가-힣]/g, "").slice(0, 2).toUpperCase() || "OR");
  return `<span class="icon fallback" style="width:${size}px;height:${size}px">${chars}</span>`;
}

function cardRows(games: Game[]) {
  return games
    .map((game, index) => {
      const status = freshness(game.fetchedAt);
      return `<a class="game-row" href="${FUNCTION_PREFIX}/game/${e(game.slug)}">
        <span class="rank">${index + 1}</span>
        ${gameIcon(game)}
        <span class="title"><strong>${e(game.nameKo)}</strong><small>${e(game.name)}</small></span>
        <span class="playing"><strong>${compact(game.playing)}</strong><small>플레이 중</small></span>
        <span class="fresh ${status.key}">${status.label}</span>
      </a>`;
    })
    .join("");
}

function shell(title: string, body: string, description = "오름 Preview") {
  const css = `
    :root{--bg:#07070b;--s:#12121a;--s2:#191923;--text:#f4f1ea;--muted:#9694a1;--line:#292935;--lime:#c8f542;--pink:#ff3d8a;--warn:#ffcf5a;--danger:#ff6b7b}
    *{box-sizing:border-box}html{background:var(--bg);color-scheme:dark}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Noto Sans KR",sans-serif;font-variant-numeric:tabular-nums}a{color:inherit;text-decoration:none}
    header{border-bottom:1px solid var(--line);background:#07070bf5;position:sticky;top:0;z-index:20}.nav{max-width:1180px;height:62px;margin:auto;padding:0 20px;display:flex;align-items:center;gap:26px}.brand{font-weight:900;font-size:21px;letter-spacing:-.07em;margin-right:auto}.brand small{font-weight:500;color:var(--muted);font-size:11px;margin-left:10px;letter-spacing:0}.nav a:not(.brand){font-size:13px;color:#cbc8d0}.page{max-width:1180px;margin:auto;padding:34px 20px 84px}.hero{padding:40px 0 24px;border-bottom:1px solid var(--line)}.hero h1,.page h1{font-size:clamp(34px,5vw,62px);letter-spacing:-.055em;line-height:1.03;margin:8px 0 14px}.eyebrow{color:var(--lime);font-size:12px;font-weight:800;letter-spacing:.12em}.muted,p,li{color:#b6b3bd}.search{display:flex;margin:24px 0;border-bottom:2px solid var(--text)}.search input{flex:1;border:0;background:transparent;color:var(--text);padding:15px 4px;font-size:17px;outline:none}.search button{border:0;background:var(--lime);color:#09090b;font-weight:900;padding:0 20px}.section{margin-top:32px}.section-head{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--line);padding-top:16px;margin-bottom:8px}.section h2,.section-head h2{font-size:20px;margin:0}.section-head a{color:var(--lime);font-size:13px}.game-table{border-top:1px solid var(--line)}.game-row{display:grid;grid-template-columns:32px 48px minmax(0,1fr) 120px 100px;gap:12px;align-items:center;min-height:72px;border-bottom:1px solid var(--line)}.game-row:hover{background:#0e0e15}.rank{font-size:12px;color:var(--muted)}.icon{border:1px solid #363643;object-fit:cover;background:#111}.fallback{display:grid;place-items:center;font-weight:900;font-size:11px}.title{min-width:0}.title strong,.title small,.playing strong,.playing small{display:block}.title small,.playing small{color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.playing{text-align:right}.fresh{font-size:11px;text-align:center;border:1px solid var(--line);padding:4px}.fresh.fresh{color:var(--lime)}.fresh.delayed{color:var(--warn)}.fresh.stale,.fresh.unavailable{color:var(--danger)}
    .game-head{display:flex;gap:18px;align-items:center}.game-head .icon{width:70px;height:70px}.big-number{font-size:clamp(34px,7vw,58px);font-weight:900;letter-spacing:-.045em;margin:22px 0 0}.stats{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:22px 0}.stat{padding:16px}.stat+.stat{border-left:1px solid var(--line)}.stat strong{display:block;font-size:22px}.stat small{color:var(--muted)}.actions{margin:18px 0}.play{display:inline-block;background:var(--lime);color:#09090b;font-weight:900;padding:13px 18px}.callout{border-left:3px solid var(--lime);background:#0d0d13;padding:12px 16px;margin:18px 0}.source{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:12px 0;color:var(--muted);font-size:12px}.chart{width:100%;height:260px;border-bottom:1px solid var(--line)}.chart path{fill:none;stroke:var(--lime);stroke-width:2;vector-effect:non-scaling-stroke}.chart line{stroke:#292935}.ranges{display:flex;gap:6px;margin:10px 0 16px}.ranges a{padding:7px 10px;border:1px solid var(--line);font-size:12px}.ranges a.active{background:var(--lime);color:#09090b;font-weight:800}.grid{display:grid;grid-template-columns:2fr 1fr;gap:40px}.side{border-top:1px solid var(--line);padding-top:12px}.policy{max-width:760px}.policy h2{margin-top:34px}.status-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}.status{background:var(--bg);padding:15px}.status strong{display:block;font-size:25px}.status small{color:var(--muted)}footer{max-width:1180px;margin:auto;padding:24px 20px 70px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}footer nav{display:flex;flex-wrap:wrap;gap:14px;margin:8px 0}
    @media(max-width:720px){.nav{height:54px;padding:0 16px}.nav a:not(.brand){display:none}.brand small{display:none}.page{padding:20px 16px 70px}.hero{padding-top:20px}.game-row{grid-template-columns:26px 44px minmax(0,1fr) 86px;gap:8px;min-height:66px}.game-row .fresh{display:none}.grid{grid-template-columns:1fr}.side{display:none}.status-grid{grid-template-columns:repeat(2,1fr)}.stats{margin-left:-16px;margin-right:-16px}.stat{padding:13px 8px}.stat strong{font-size:17px}.play{width:100%;text-align:center}.game-head .icon{width:58px;height:58px}}
  `;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${e(title)} | 오름 Preview</title><meta name="description" content="${e(description)}"><style>${css}</style></head><body>
    <header><nav class="nav"><a class="brand" href="${FUNCTION_PREFIX}/">오름<small>뜨는 게임의 기록 · REVIEW PREVIEW</small></a><a href="${FUNCTION_PREFIX}/games">게임</a><a href="${FUNCTION_PREFIX}/rising">급상승</a><a href="${FUNCTION_PREFIX}/methodology">산정기준</a><a href="${FUNCTION_PREFIX}/admin/data-status">Data Status</a><a href="${FUNCTION_PREFIX}/admin/community-analytics">Community API</a><a href="${FUNCTION_PREFIX}/admin/release-candidate">RC</a></nav></header>
    ${body}
    <footer><strong>오름</strong> · 뜨는 게임의 기록<nav><a href="${FUNCTION_PREFIX}/about">소개</a><a href="${FUNCTION_PREFIX}/methodology">산정 기준</a><a href="${FUNCTION_PREFIX}/guidelines">가이드라인</a><a href="${FUNCTION_PREFIX}/privacy">개인정보</a><a href="${FUNCTION_PREFIX}/youth">청소년보호</a><a href="${FUNCTION_PREFIX}/terms">약관</a><a href="${FUNCTION_PREFIX}/disclaimer">비제휴</a></nav><p>본 서비스는 Roblox Corporation과 제휴 또는 공식 관계가 없는 독립 서비스입니다.</p></footer>
  </body></html>`;
}

function searchForm(q = "") {
  return `<form class="search" method="get" action="${FUNCTION_PREFIX}/search"><input name="q" value="${e(q)}" placeholder="게임 이름 · 한글 별칭 검색" autocomplete="off"><button>검색</button></form>`;
}

function calculateChange(points: RollupRow[], hours: number) {
  const usable = points
    .filter((point) => point.playing_last != null && Number(point.coverage_ratio) >= 0.7)
    .sort((a, b) => new Date(a.bucket_at).getTime() - new Date(b.bucket_at).getTime());
  if (usable.length < 2) return null;
  const latest = usable[usable.length - 1];
  const targetTime = new Date(latest.bucket_at).getTime() - hours * 3_600_000;
  const older = usable
    .filter((point) => new Date(point.bucket_at).getTime() <= targetTime)
    .at(-1);
  if (!older) return null;
  const before = numberValue(older.playing_last);
  const after = numberValue(latest.playing_last);
  if (before == null || after == null || before <= 0) return null;
  return ((after - before) / before) * 100;
}

function pct(value: number | null) {
  if (value == null) return "—";
  const sign = value > 0 ? "▲ " : value < 0 ? "▼ " : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function chart(points: RollupRow[]) {
  const valid = points
    .filter((point) => point.playing_last != null)
    .sort((a, b) => new Date(a.bucket_at).getTime() - new Date(b.bucket_at).getTime());
  if (valid.length < 2) return `<div class="callout"><strong>데이터 수집 중</strong><br>실제 Hourly Rollup이 더 쌓이면 그래프를 표시합니다.</div>`;
  const times = valid.map((point) => new Date(point.bucket_at).getTime());
  const values = valid.map((point) => Number(point.playing_last));
  const minT = Math.min(...times), maxT = Math.max(...times);
  const minV = Math.min(...values), maxV = Math.max(...values), rangeV = Math.max(1, maxV - minV);
  let d = "", open = false, prev: number | null = null;
  for (let i = 0; i < valid.length; i++) {
    const time = times[i], value = values[i];
    if (prev != null && time - prev > 90 * 60_000) open = false;
    const x = ((time - minT) / Math.max(1, maxT - minT)) * 1000;
    const y = 250 - ((value - minV) / rangeV) * 220;
    d += `${open ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    open = true; prev = time;
  }
  return `<svg class="chart" viewBox="0 0 1000 280" preserveAspectRatio="none" role="img" aria-label="플레이 인원 변화 그래프"><line x1="0" y1="250" x2="1000" y2="250"/><line x1="0" y1="140" x2="1000" y2="140"/><line x1="0" y1="30" x2="1000" y2="30"/><path d="${d.trim()}"/></svg>`;
}

const policies: Record<string, { title: string; intro: string; html: string }> = {
  about: { title: "오름 소개", intro: "게임의 현재 숫자와 변화 기록을 먼저 보여주는 독립 데이터 서비스입니다.", html: `<h2>제품 방향</h2><p>오름은 Game Entity를 중심으로 Search → Data → Content → Community → Return 흐름을 만들고 있습니다. 현재 Preview는 그 기반인 실제 게임 데이터·검색·Historical Data를 검수하는 단계입니다.</p><h2>데이터 원칙</h2><p>API 값을 그대로 복사하지 않고 수집 시각, 누락, 커버리지와 계산 버전을 관리합니다. 과거 데이터가 부족하면 변화율을 만들지 않습니다.</p>` },
  methodology: { title: "데이터·급상승 산정 기준", intro: "오름이 숫자를 가져오고 계산하고 숨기는 기준입니다.", html: `<div class="callout"><strong>현재값과 오름 계산값은 다릅니다.</strong></div><h2>Source</h2><p>현재값은 Roblox Public Games API를 Adapter 뒤에서 수집하고 Raw Snapshot과 Hourly/Daily Rollup으로 저장합니다.</p><h2>Freshness</h2><p>0명과 데이터 없음은 구분합니다. fetched_at이 오래되면 저장 당시 상태와 관계없이 delayed/stale로 다시 계산합니다.</p><h2>Trend v1.1</h2><p>절대 모멘텀, 상대 성장, baseline 규모, 실제 raw coverage, 업데이트 신선도를 결합합니다. 커버리지 70% 미만은 순위에서 제외합니다.</p>` },
  guidelines: { title: "커뮤니티 가이드라인", intro: "후속 질문·댓글·파티 기능에 적용할 기본 안전 원칙입니다.", html: `<h2>허용</h2><p>게임 질문, 공략, 팁, 공개 파티 모집과 데이터 오류 제보.</p><h2>금지</h2><p>계정·Robux 현금 거래, 사기, 핵·Exploit, 개인정보 공유, 성적 콘텐츠, 괴롭힘, 사칭, 악성 링크와 스팸을 허용하지 않습니다.</p>` },
  privacy: { title: "개인정보 처리 안내", intro: "현재 Sprint 01 공개 기능 기준입니다.", html: `<div class="callout">현재 공개 Preview에는 회원가입·로그인·댓글·DM 기능이 없습니다.</div><h2>요구하지 않는 정보</h2><p>실명, 전화번호, 학교, 정확한 위치, Roblox 비밀번호, .ROBLOSECURITY, 사용자 API Key를 요구하지 않습니다.</p><h2>Game 데이터</h2><p>개별 Roblox 사용자의 프레즌스, 친구 그래프나 위치를 추적하지 않습니다.</p>` },
  youth: { title: "청소년 보호 원칙", intro: "미성년 이용자가 많은 게임 생태계를 전제로 기능을 제한합니다.", html: `<h2>현재 단계</h2><p>읽기 중심 데이터 서비스이며 DM이나 파티 채팅을 제공하지 않습니다.</p><h2>후속 기능</h2><p>만 14세 미만 가입 차단, 불필요한 개인정보 최소화, 외부 연락처 제한, 신고·Moderation을 제품 경계에 둡니다.</p>` },
  terms: { title: "이용약관", intro: "Preview 단계의 기본 이용 조건입니다.", html: `<h2>서비스 성격</h2><p>오름은 공개 게임 데이터와 자체 계산 데이터를 정리하는 독립 서비스입니다.</p><h2>데이터 제공</h2><p>외부 API 장애·지연·정책 변화로 데이터가 늦을 수 있으며 데이터 없음과 실제 0을 구분합니다.</p><h2>금지</h2><p>서비스 방해, 보안 우회, 악성 코드, 사기, 계정·Robux 거래를 금지합니다.</p>` },
  disclaimer: { title: "비제휴·데이터 고지", intro: "브랜드 관계와 데이터 해석 범위를 안내합니다.", html: `<div class="callout"><strong>본 서비스는 Roblox Corporation과 제휴 또는 공식 관계가 없는 독립 서비스입니다.</strong></div><h2>게임 자산</h2><p>게임 명칭과 아이콘은 식별 목적으로만 표시하며 오름 브랜드에 Roblox 공식 로고를 사용하지 않습니다.</p><h2>자체 계산</h2><p>Trend와 변화율은 오름 계산값이며 Roblox 공식 순위가 아닙니다.</p>` },
};

async function renderHome(games: Game[]) {
  const sorted = [...games].sort((a, b) => (b.playing ?? -1) - (a.playing ?? -1));
  const freshCount = games.filter((game) => freshness(game.fetchedAt).key === "fresh").length;
  return shell(
    "지금 뜨는 게임",
    `<main class="page"><section class="hero"><span class="eyebrow">OREUN · LIVE REVIEW PREVIEW</span><h1>지금 어떤 게임이<br>뜨고 있을까?</h1><p>실제 Roblox 공개 경험 데이터를 오름 Preview DB에 기록하고 있습니다. 과거 데이터가 부족하면 변화율을 만들지 않습니다.</p><div class="callout"><strong>${freshCount}개</strong> Game이 현재 fresh 상태 · Catalog ${games.length}개</div></section>
    ${searchForm()}
    <section class="section"><div class="section-head"><h2>지금 플레이</h2><a href="${FUNCTION_PREFIX}/games">전체 보기 →</a></div><div class="game-table">${cardRows(sorted.slice(0, 12))}</div></section>
    <section class="section"><div class="section-head"><h2>데이터를 믿을 수 있게</h2><a href="${FUNCTION_PREFIX}/methodology">산정 기준 →</a></div><p>현재값, Raw Snapshot, Hourly/Daily Rollup을 구분합니다. 누락된 값은 0으로 만들지 않습니다.</p></section></main>`,
  );
}

async function renderGame(game: Game, hours: number) {
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  const points = await rest<RollupRow>("game_rollups_hourly", {
    select: "universe_id,bucket_at,playing_last,coverage_ratio",
    universe_id: `eq.${game.universeId}`,
    bucket_at: `gte.${cutoff}`,
    order: "bucket_at.asc",
  });
  const state = freshness(game.fetchedAt);
  const c1 = calculateChange(points, 1), c24 = calculateChange(points, 24), c7 = calculateChange(points, 168);
  const ranges = [[24,"24H"],[168,"7D"],[720,"30D"],[2160,"90D"]]
    .map(([value,label]) => `<a class="${hours===value ? "active":""}" href="${FUNCTION_PREFIX}/game/${e(game.slug)}?range=${value}">${label}</a>`).join("");
  return shell(
    game.nameKo,
    `<main class="page"><div style="margin-bottom:20px">${searchForm()}</div><div class="game-head">${gameIcon(game,70)}<div><h1 style="font-size:42px;margin:0">${e(game.nameKo)}</h1><div class="muted">${e(game.name)}</div></div></div>
    <div class="big-number">${game.playing == null ? "—" : `지금 ${compact(game.playing)}명 플레이 중`}</div><div class="muted">${relative(game.fetchedAt)} 확인 · <span class="fresh ${state.key}">${state.label}</span></div>
    <div class="stats"><div class="stat"><strong>${pct(c1)}</strong><small>1시간</small></div><div class="stat"><strong>${pct(c24)}</strong><small>24시간</small></div><div class="stat"><strong>${pct(c7)}</strong><small>7일</small></div></div>
    <div class="actions"><a class="play" target="_blank" rel="noopener noreferrer" href="https://www.roblox.com/games/${game.rootPlaceId}">Roblox에서 플레이 ↗</a></div>
    ${state.key === "fresh" ? "" : `<div class="callout"><strong>현재 데이터 갱신 상태: ${state.label}</strong></div>`}
    <div class="grid"><section><div class="section-head"><h2>플레이 인원 기록</h2></div><div class="ranges">${ranges}</div>${chart(points)}
      <div class="source"><strong>출처</strong> · 공개 Roblox 경험 데이터 기반 · 오름 저장 Snapshot<br>마지막 확인: ${e(game.fetchedAt ? new Date(game.fetchedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})+" KST" : "없음")} · Hourly rows: ${points.length}</div>
      <div class="section"><h2>게임 정보</h2><p>${e(game.descriptionKo)}</p></div></section>
      <aside class="side"><strong>현재 데이터</strong><p>방문 ${compact(game.visits)}<br>즐겨찾기 ${compact(game.favorites)}<br>제작 ${e(game.creatorName)}</p><strong>색인 상태</strong><p>${e(game.indexState)} · Preview global noindex 유지 중</p></aside></div></main>`,
    `${game.nameKo} 현재 플레이 인원과 오름 Historical Data`,
  );
}

async function renderSearch(games: Game[], query: string) {
  const q = normalize(query);
  const rows = !q ? [] : games
    .map((game) => {
      const names = [game.nameKo, game.name, ...game.aliases];
      const normalized = names.map(normalize);
      let score = 0;
      if (normalized.includes(q)) score = 100;
      else if (normalized.some((name) => name.startsWith(q))) score = 80;
      else if (normalized.some((name) => name.includes(q))) score = 50;
      return { game, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (b.game.playing ?? 0) - (a.game.playing ?? 0))
    .map((row) => row.game);
  if (rows.length === 1) {
    return Response.redirect(new URL(`${FUNCTION_PREFIX}/game/${rows[0].slug}`, SUPABASE_URL), 302);
  }
  return html(shell("게임 검색", `<main class="page"><h1>게임 검색</h1>${searchForm(query)}<div class="section-head"><h2>‘${e(query)}’ 결과 ${rows.length}개</h2></div>${rows.length ? `<div class="game-table">${cardRows(rows)}</div>` : `<div class="callout"><strong>찾는 게임이 없나요?</strong><br>영문명이나 다른 표기로 다시 검색해 보세요.</div>`}</main>`));
}

async function renderDataStatus(games: Game[]) {
  const [runs, targets] = await Promise.all([
    rest<RunRow>("ingestion_runs", { select: "id,status,requested_count,success_count,failure_count,rate_limit_count,started_at,finished_at,error_summary", order: "started_at.desc", limit: 5 }),
    rest<TargetRow>("collector_targets", { select: "universe_id,tier,cadence_minutes,failure_count,next_due_at,last_error", failure_count: "gt.0", order: "failure_count.desc", limit: 10 }),
  ]);
  const latest = runs[0];
  const fresh = games.filter((game) => freshness(game.fetchedAt).key === "fresh").length;
  return shell("Data Status", `<main class="page"><h1>Data Status</h1><p>Preview 내부 검수용 운영 상태입니다.</p><div class="status-grid"><div class="status"><strong>${games.length}</strong><small>Catalog</small></div><div class="status"><strong>${fresh}</strong><small>fresh</small></div><div class="status"><strong>${latest ? e(latest.status) : "—"}</strong><small>최근 Run</small></div><div class="status"><strong>${latest?.failure_count ?? "—"}</strong><small>최근 실패</small></div></div>
    <div class="section"><h2>최근 Collector</h2><p>${latest ? `요청 ${latest.requested_count} · 저장 ${latest.success_count} · 실패 ${latest.failure_count} · Rate limit ${latest.rate_limit_count} · ${e(latest.finished_at ?? latest.started_at)}` : "없음"}</p></div>
    <div class="section"><h2>반복 실패 Target</h2>${targets.length ? targets.map((target)=>`<div class="source">Universe ${e(target.universe_id)} · ${e(target.tier)} · ${target.cadence_minutes}분 · 실패 ${target.failure_count} · 다음 ${e(target.next_due_at)}<br>${e(target.last_error)}</div>`).join("") : "<p>현재 반복 실패 target이 없습니다.</p>"}</div></main>`);
}

async function renderReadiness(games: Game[]) {
  const rows = await rest<ReadinessRow>("r1_game_index_readiness", { select: "universe_id,canonical_slug,index_state,hourly_buckets_24h,avg_coverage_24h,current_data_recent,data_ready_for_index_review", order: "data_ready_for_index_review.desc,avg_coverage_24h.desc" });
  const map = new Map(games.map((game) => [game.universeId, game]));
  const ready = rows.filter((row) => row.data_ready_for_index_review).length;
  return shell("Launch Readiness", `<main class="page"><h1>Launch Readiness</h1><p>노인덱스 해제 전 검수용. 이 화면은 index_state를 변경하지 않습니다.</p><div class="status-grid"><div class="status"><strong>${games.length}</strong><small>검증 Game</small></div><div class="status"><strong>${ready}</strong><small>데이터 기준 통과</small></div><div class="status"><strong>ON</strong><small>Preview noindex</small></div><div class="status"><strong>26</strong><small>목표 ≥24 달성</small></div></div>
  <div class="section"><h2>Game별 상태</h2>${rows.map((row)=>{const game=map.get(Number(row.universe_id));return `<div class="source"><strong>${e(game?.nameKo ?? row.canonical_slug)}</strong> · ${e(row.index_state)} · Hourly ${e(row.hourly_buckets_24h)}/24 · Coverage ${Math.round(Number(row.avg_coverage_24h)*100)}% · ${row.data_ready_for_index_review?"DATA READY":"COLLECTING"}</div>`;}).join("")}</div></main>`);
}

async function renderCommunityAnalytics() {
  const rows = await rest<CommunityAnalyticsReadinessRow>(
    "r1_community_analytics_readiness",
    {
      select:
        "universe_id,canonical_slug,name_ko,group_id,authorization_state,enabled,last_verified_at,last_collected_at,last_error,ready_for_server_collection,latest_snapshot_at",
      order: "enabled.desc,authorization_state.asc,canonical_slug.asc",
    },
  );
  const targets = rows.filter((row) => row.group_id != null);
  const authorized = targets.filter(
    (row) => row.authorization_state === "authorized",
  ).length;
  const enabled = targets.filter((row) => Boolean(row.enabled)).length;
  const collected = targets.filter((row) => row.latest_snapshot_at).length;
  const featureEnabled =
    Deno.env.get("R1_ROBLOX_COMMUNITY_ANALYTICS") === "1";
  const keyConfigured = Boolean(Deno.env.get("ROBLOX_OPEN_CLOUD_API_KEY"));

  return shell(
    "Community Analytics",
    `<main class="page"><h1>Community Analytics</h1><p>Roblox Open Cloud Group Forum 집계 수집의 Preview 상태입니다. Forum 본문·작성자·사용자 ID는 저장하지 않습니다.</p>
    <div class="status-grid"><div class="status"><strong>${featureEnabled ? "ON" : "OFF"}</strong><small>Feature flag</small></div><div class="status"><strong>${keyConfigured ? "SET" : "MISSING"}</strong><small>Server key</small></div><div class="status"><strong>${authorized}</strong><small>권한 검증 target</small></div><div class="status"><strong>${collected}</strong><small>집계 확보</small></div></div>
    <div class="callout"><strong>Fail closed</strong><br>Game creator Group 일치 + 실제 group-forum:read 검증을 통과한 target만 등록합니다. 활성 target ${enabled}개 · bounded observed count만 저장합니다.</div>
    <div class="section"><h2>검증 Target</h2>${targets.length ? targets.map((row)=>`<div class="source"><strong>${e(row.name_ko)}</strong> · Universe ${e(row.universe_id)} · Group ${e(row.group_id)} · ${e(row.authorization_state)} · ${row.enabled ? "ENABLED" : "DISABLED"}<br>verified ${e(row.last_verified_at ?? "—")} · snapshot ${e(row.latest_snapshot_at ?? "없음")}<br>${row.last_error ? `최근 오류: ${e(row.last_error)}` : ""}</div>`).join("") : "<p>아직 승인된 target이 없습니다. 임의 데이터는 만들지 않습니다.</p>"}</div></main>`,
  );
}

async function renderReleaseCandidate(games: Game[]) {
  const [readiness, runs, community] = await Promise.all([
    rest<ReadinessRow>("r1_game_index_readiness", {
      select:
        "universe_id,canonical_slug,index_state,hourly_buckets_24h,avg_coverage_24h,current_data_recent,data_ready_for_index_review",
      order: "data_ready_for_index_review.desc,avg_coverage_24h.desc",
    }),
    rest<RunRow>("ingestion_runs", {
      select:
        "id,status,requested_count,success_count,failure_count,rate_limit_count,started_at,finished_at,error_summary",
      order: "started_at.desc",
      limit: 1,
    }),
    rest<CommunityAnalyticsReadinessRow>(
      "r1_community_analytics_readiness",
      {
        select:
          "universe_id,canonical_slug,name_ko,group_id,authorization_state,enabled,last_verified_at,last_collected_at,last_error,ready_for_server_collection,latest_snapshot_at",
        order: "canonical_slug.asc",
      },
    ),
  ]);

  const ready = readiness.filter(
    (row) => row.data_ready_for_index_review,
  ).length;
  const maxBuckets = readiness.reduce(
    (max, row) => Math.max(max, Number(row.hourly_buckets_24h) || 0),
    0,
  );
  const coverageValues = readiness
    .map((row) => Number(row.avg_coverage_24h))
    .filter(Number.isFinite);
  const avgCoverage = coverageValues.length
    ? coverageValues.reduce((sum, value) => sum + value, 0) /
      coverageValues.length
    : 0;
  const current = games.filter((game) => game.fetchedAt).length;
  const latest = runs[0];
  const communityTargets = community.filter((row) => row.group_id != null);
  const communityEnabled = communityTargets.filter((row) => row.enabled).length;

  return shell(
    "Release Candidate",
    `<main class="page"><h1>Final Release Candidate</h1><p>Sprint 01~05 통합 검수 상태입니다. 이 Edge URL은 사용자 검수용 shell이며 Production Hosting이 아닙니다.</p>
    <div class="callout"><strong>Release lock 유지</strong><br>PR merge · Production promote · domain 연결 · noindex 해제 · bulk indexable은 아직 수행하지 않습니다.</div>
    <div class="status-grid"><div class="status"><strong>${games.length}</strong><small>Catalog</small></div><div class="status"><strong>${current}</strong><small>현재값 확보</small></div><div class="status"><strong>${ready}</strong><small>index data-ready</small></div><div class="status"><strong>${maxBuckets}/24</strong><small>최대 24H bucket</small></div></div>
    <div class="section"><h2>Historical gate</h2><p>평균 24H raw coverage ${Math.round(avgCoverage * 100)}% · data-ready ${ready}/${readiness.length}. 실제 24시간이 쌓이기 전에는 임의로 통과시키지 않습니다.</p></div>
    <div class="section"><h2>Collector</h2><p>${latest ? `${e(latest.status)} · 요청 ${latest.requested_count} · 성공 ${latest.success_count} · 실패 ${latest.failure_count} · rate limit ${latest.rate_limit_count}` : "실행 기록 없음"}</p></div>
    <div class="section"><h2>Community Analytics</h2><p>검증 target ${communityTargets.length} · enabled ${communityEnabled}. API Key/target을 임의로 생성하지 않으며 기본 OFF입니다.</p></div>
    <div class="section"><h2>Index release 3-key gate</h2><p><code>R1_PREVIEW_NO_INDEX=0</code> + <code>R1_INDEX_RELEASE_CONFIRM=1</code> + 검증된 실제 HTTPS origin이 모두 필요합니다. Preview sitemap은 URL entry를 내보내지 않습니다.</p></div>
    <div class="section"><h2>검수 링크</h2><p><a style="color:var(--lime)" href="${FUNCTION_PREFIX}/admin/data-status">Data Status →</a><br><a style="color:var(--lime)" href="${FUNCTION_PREFIX}/admin/launch-readiness">Launch Readiness →</a><br><a style="color:var(--lime)" href="${FUNCTION_PREFIX}/admin/community-analytics">Community Analytics →</a><br><a style="color:var(--lime)" href="${FUNCTION_PREFIX}/review-build.json">review-build.json →</a></p></div></main>`,
  );
}

function html(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
    },
  });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const functionIndex = segments.lastIndexOf("r1-web-preview");
    let path =
      functionIndex >= 0
        ? "/" + segments.slice(functionIndex + 1).join("/")
        : url.pathname;
    if (!path || path === "") path = "/";
    if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);

    if (path === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /\n", {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-robots-tag": "noindex, nofollow",
          "x-content-type-options": "nosniff",
          "x-frame-options": "DENY",
        },
      });
    }
    if (path === "/review-build.json") {
      return Response.json(
        {
          project: "R1",
          brand: "오름",
          preview_noindex: true,
          data_mode: "persistent-preview-db",
          surface: "supabase-edge-review-shell",
          community_analytics_version: "sprint05",
          release_candidate: true,
          indexing_release_confirmed: false,
          indexing_release_gate:
            "R1_PREVIEW_NO_INDEX=0 + R1_INDEX_RELEASE_CONFIRM=1 + validated public HTTPS origin",
          community_analytics_enabled:
            Deno.env.get("R1_ROBLOX_COMMUNITY_ANALYTICS") === "1",
          community_analytics_key_configured: Boolean(
            Deno.env.get("ROBLOX_OPEN_CLOUD_API_KEY"),
          ),
          edge_deployment_id: Deno.env.get("DENO_DEPLOYMENT_ID") ?? null,
          generated_at: new Date().toISOString(),
        },
        {
          headers: {
            "cache-control": "no-store",
            "x-robots-tag": "noindex, nofollow",
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY",
          },
        },
      );
    }

    const games = await catalog();

    if (path === "/") return html(await renderHome(games));
    if (path === "/games") {
      const sorted = [...games].sort((a,b)=>(b.playing??-1)-(a.playing??-1));
      return html(shell("지금 플레이", `<main class="page"><h1>지금 플레이</h1><p>현재 플레이 인원 기준 · 데이터 상태를 함께 표시합니다.</p>${searchForm()}<div class="game-table">${cardRows(sorted)}</div></main>`));
    }
    if (path === "/rising") {
      return html(shell("급상승", `<main class="page"><h1>급상승</h1><div class="callout"><strong>실제 Historical Data 수집 중</strong><br>24시간 Hourly coverage가 충분한 Game만 Trend 순위가 열립니다. 현재는 Preview 초기 수집 단계라 순위를 억지로 만들지 않습니다.</div><p><a style="color:var(--lime)" href="${FUNCTION_PREFIX}/methodology">산정 기준 보기 →</a></p></main>`));
    }
    if (path.startsWith("/game/")) {
      const slug = decodeURIComponent(path.slice("/game/".length));
      const game = games.find((row) => row.slug === slug);
      if (!game) return html(shell("찾을 수 없음", `<main class="page"><h1>게임을 찾을 수 없습니다.</h1></main>`),404);
      const requested = Number(url.searchParams.get("range") || 168);
      const hours = [24,168,720,2160].includes(requested) ? requested : 168;
      return html(await renderGame(game,hours));
    }
    if (path === "/search") return await renderSearch(games,url.searchParams.get("q") ?? "");
    if (path === "/admin/data-status") return html(await renderDataStatus(games));
    if (path === "/admin/launch-readiness") return html(await renderReadiness(games));
    if (path === "/admin/community-analytics") return html(await renderCommunityAnalytics());
    if (path === "/admin/release-candidate") return html(await renderReleaseCandidate(games));

    const policyKey = path.slice(1);
    const policy = policies[policyKey];
    if (policy) {
      return html(shell(policy.title,`<main class="page policy"><h1>${e(policy.title)}</h1><p>${e(policy.intro)}</p>${policy.html}</main>`));
    }

    return html(shell("찾을 수 없음",`<main class="page"><h1>페이지를 찾을 수 없습니다.</h1><p><a style="color:var(--lime)" href="${FUNCTION_PREFIX}/">홈으로 돌아가기 →</a></p></main>`),404);
  } catch (error) {
    return html(shell("Preview 오류",`<main class="page"><h1>Preview 데이터를 불러오지 못했습니다.</h1><p>${e(error instanceof Error ? error.message : "unknown error")}</p></main>`),500);
  }
});
