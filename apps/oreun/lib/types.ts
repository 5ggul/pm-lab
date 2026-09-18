export type SourceClass = "OFFICIAL_OPEN_CLOUD" | "ROBLOX_PUBLIC_API" | "R1_DERIVED" | "R1_EDITORIAL" | "COMMUNITY_UGC";
export type FreshnessState = "fresh" | "delayed" | "stale" | "unavailable" | "insufficient_data";
export type Confidence = "high" | "medium" | "low" | "insufficient";
export type IndexState = "collecting" | "candidate" | "indexable" | "noindex" | "retired";

export interface GameIdentity {
  universeId: number;
  rootPlaceId: number;
  slug: string;
  nameKo: string;
  aliases: string[];
  descriptionKo: string;
  indexState: IndexState;
}

export interface ProviderGame {
  universeId: number;
  rootPlaceId: number;
  name: string;
  description: string;
  creatorName: string;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  sourceProvider: string;
  sourceEndpoint: string;
  sourceClass: SourceClass;
  sourceStatus: "live" | "fallback";
}

export interface GameView extends GameIdentity, ProviderGame {
  freshnessState: FreshnessState;
  fallbackReason?: string;
}

export interface Snapshot {
  universeId: number;
  capturedAt: string;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  rawOrDerived: "raw" | "derived";
  sourceProvider: string;
  ingestionRunId?: string;
}

export interface HistoryPoint { at: string; playing: number | null; }

export interface TrendResult {
  universeId: number;
  score: number | null;
  eligible: boolean;
  confidence: Confidence;
  calculationVersion: "trend_v1";
  components: {
    absolute: number;
    relative: number;
    baseline: number;
    coverage: number;
    update: number;
    interest: number | null;
  };
  metrics: { baseline: number | null; recent: number | null; coverageRatio: number; relativeGrowth: number | null; absoluteMomentum: number | null; };
  reason: string;
}
