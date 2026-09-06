"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { RadarSignal, RadarSnapshot, SignalType } from "../lib/types";

type Props = { initial: RadarSnapshot };

type SortKey = "score" | "newest" | "buyers" | "flow";

const money = (value: number | null) => {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${value < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

const ago = (iso: string, clockMs: number) => {
  const seconds = Math.max(0, Math.floor((clockMs - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

const signalLabel: Record<SignalType, string> = {
  BUY_RESONANCE: "BUY RESONANCE",
  SELL_RESONANCE: "SELL RESONANCE",
  REVERSAL: "REVERSAL",
  ACCELERATION: "ACCELERATION",
  WATCH: "WATCH"
};

const signalClass = (type: SignalType) => {
  if (type === "BUY_RESONANCE") return "buy";
  if (type === "SELL_RESONANCE") return "sell";
  if (type === "REVERSAL") return "reversal";
  if (type === "ACCELERATION") return "acceleration";
  return "";
};

const scoreClass = (score: number) => (score >= 85 ? "hot" : score >= 70 ? "mid" : "low");

export function LiveRadar({ initial }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [chain, setChain] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("score");
  const [clockMs, setClockMs] = useState(() => new Date(initial.generatedAt).getTime());

  useEffect(() => {
    const refresh = window.setInterval(async () => {
      try {
        const response = await fetch("/api/radar", { cache: "no-store" });
        if (response.ok) setSnapshot((await response.json()) as RadarSnapshot);
      } catch {
        // Keep the last good snapshot on transient network failures.
      }
    }, 10_000);
    const clock = window.setInterval(() => setClockMs(Date.now()), 1_000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...snapshot.signals]
      .filter((row) => chain === "all" || row.chain === chain)
      .filter((row) => row.score >= minScore)
      .filter((row) => !q || row.symbol.toLowerCase().includes(q) || row.tokenAddress.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "newest") return new Date(b.lastTradeAt).getTime() - new Date(a.lastTradeAt).getTime();
        if (sort === "buyers") return b.buyers15m - a.buyers15m;
        if (sort === "flow") return b.netFlow15m - a.netFlow15m;
        return b.score - a.score;
      });
  }, [snapshot.signals, chain, minScore, query, sort]);

  const strong = snapshot.signals.filter((s) => s.score >= 85).length;
  const accelerating = snapshot.signals.filter((s) => s.signalType === "ACCELERATION").length;
  const netFlow = snapshot.signals.reduce((sum, s) => sum + s.netFlow15m, 0);
  const uniqueChains = new Set(snapshot.signals.map((s) => s.chain)).size;

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow"><span className="live-dot" /> live convergence radar</div>
          <h1>누가 같이 움직이는지 먼저 본다.</h1>
          <p>독립 트레이더의 동시 매수·매도, 시간 집중도, 순매수와 유동성을 합쳐 공진 신호를 계산합니다. 1분 polling은 기본 백업이며 실시간 이벤트 소스가 연결되면 수초 단위로 전환됩니다.</p>
        </div>
        <div className="hero-side">
          <span className={`badge ${snapshot.health.status === "LIVE" ? "live" : snapshot.health.status === "DELAYED" ? "danger" : "warn"}`}>
            {snapshot.health.status === "LIVE" ? "● LIVE" : snapshot.health.status}
          </span>
          <span className="badge">Last sync {ago(snapshot.health.lastSyncAt, clockMs)}</span>
          <span className="badge">{snapshot.mode === "demo" ? "DEMO DATA" : snapshot.health.source}</span>
        </div>
      </section>

      {snapshot.mode === "demo" && (
        <div className="notice" style={{ marginBottom: 14 }}>
          현재는 외부 API와 Supabase 키가 연결되지 않은 프리뷰 모드입니다. 화면·점수·필터·상세 흐름은 실제 운영 구조와 동일하고 데이터만 샘플입니다.
        </div>
      )}

      <section className="kpi-grid" aria-label="Radar summary">
        <div className="kpi"><div className="kpi-label">Strong signals</div><div className="kpi-value">{strong}</div><div className="kpi-note">score 85+</div></div>
        <div className="kpi"><div className="kpi-label">Accelerating</div><div className="kpi-value">{accelerating}</div><div className="kpi-note">buyer density rising</div></div>
        <div className="kpi"><div className="kpi-label">15m net flow</div><div className={`kpi-value ${netFlow >= 0 ? "flow-up" : "flow-down"}`}>{money(netFlow)}</div><div className="kpi-note">tracked universe</div></div>
        <div className="kpi"><div className="kpi-label">Chains</div><div className="kpi-value">{uniqueChains}</div><div className="kpi-note">active sources</div></div>
      </section>

      <section>
        <div className="toolbar">
          <div className="toolbar-left">
            <select className="select" value={chain} onChange={(e) => setChain(e.target.value)} aria-label="Chain">
              <option value="all">All chains</option>
              {[...new Set(snapshot.signals.map((s) => s.chain))].map((c) => <option value={c} key={c}>{c}</option>)}
            </select>
            <select className="select" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} aria-label="Minimum score">
              <option value={0}>All scores</option>
              <option value={70}>70+</option>
              <option value={85}>85+</option>
            </select>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
              <option value="score">Score ↓</option>
              <option value="newest">Newest</option>
              <option value="buyers">15m buyers</option>
              <option value="flow">Net flow</option>
            </select>
          </div>
          <div className="toolbar-right">
            <input className="search" placeholder="Search token / address" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Token</th><th>Score</th><th>Signal</th><th>Buyers 5m / 15m / 1h</th><th>Sellers 15m</th><th>15m Net Flow</th><th>Liquidity</th><th>Top traders</th><th>Last trade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.chain}:${row.tokenAddress}`}>
                  <td>
                    <Link className="token-cell" href={`/token/${encodeURIComponent(row.chain)}/${encodeURIComponent(row.tokenAddress)}`}>
                      <span className="token-icon">{row.symbol.slice(0, 2)}</span>
                      <span><span className="token-symbol">{row.symbol}</span><span className="token-meta">{row.chain}</span></span>
                    </Link>
                  </td>
                  <td><span className={`score ${scoreClass(row.score)}`}>{row.score}</span></td>
                  <td><span className={`signal ${signalClass(row.signalType)}`}>{signalLabel[row.signalType]}</span></td>
                  <td><div className="window-cell"><span className={`window-pill ${row.buyers5m >= 3 ? "hot" : ""}`}>{row.buyers5m}</span><span className={`window-pill ${row.buyers15m >= 5 ? "hot" : ""}`}>{row.buyers15m}</span><span className="window-pill">{row.buyers60m}</span></div></td>
                  <td>{row.sellers15m}</td>
                  <td className={row.netFlow15m >= 0 ? "flow-up" : "flow-down"}>{row.netFlow15m >= 0 ? "+" : ""}{money(row.netFlow15m)}</td>
                  <td>{money(row.liquidityUsd)}</td>
                  <td>{row.topTraders}</td>
                  <td className="muted">{ago(row.lastTradeAt, clockMs)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="empty">조건에 맞는 신호가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-grid">
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Latest tracked trades</div><div className="panel-sub">collector에 들어온 최근 이벤트</div></div><span className="badge">auto 10s</span></div>
          <div className="panel-body timeline">
            {snapshot.recentTrades.slice(0, 6).map((trade) => (
              <div className="timeline-row" key={trade.id}>
                <div className="timeline-time">{ago(trade.executedAt, clockMs)}</div>
                <div className="timeline-main"><strong>{trade.trader}</strong><span className={trade.side === "BUY" ? "flow-up" : "flow-down"}>{trade.side}</span> <span className="muted">{trade.symbol}</span></div>
                <div className={`timeline-value ${trade.side === "BUY" ? "flow-up" : "flow-down"}`}>{money(trade.amountUsd)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Collector health</div><div className="panel-sub">실시간 수집기 상태</div></div></div>
          <div className="panel-body health-list">
            <div className="health-row"><span className="health-label">Status</span><span className={`health-value ${snapshot.health.status === "LIVE" ? "flow-up" : snapshot.health.status === "DELAYED" ? "flow-down" : ""}`}>{snapshot.health.status}</span></div>
            <div className="health-row"><span className="health-label">Last sync</span><span className="health-value">{ago(snapshot.health.lastSyncAt, clockMs)}</span></div>
            <div className="health-row"><span className="health-label">API latency</span><span className="health-value">{snapshot.health.apiLatencyMs == null ? "—" : `${snapshot.health.apiLatencyMs} ms`}</span></div>
            <div className="health-row"><span className="health-label">Events / last run</span><span className="health-value">{snapshot.health.eventsLastRun}</span></div>
            <div className="health-row"><span className="health-label">Source</span><span className="health-value">{snapshot.health.source}</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
