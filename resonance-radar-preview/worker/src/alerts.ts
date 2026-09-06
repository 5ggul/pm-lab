import type { Env, RadarState } from "./types";

const money = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${value < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

export function alertReason(previous: Record<string, unknown> | null, next: RadarState, env: Env): string | null {
  const buyThreshold = Number(env.BUY_SIGNAL_THRESHOLD ?? 70);
  const strongThreshold = Number(env.STRONG_SIGNAL_THRESHOLD ?? 85);
  const previousScore = Number(previous?.score ?? 0);
  const previousType = String(previous?.signal_type ?? "WATCH");

  if (next.signalType === "REVERSAL" && previousType !== "REVERSAL") return "REVERSAL";
  if ((next.signalType === "SELL_RESONANCE") && previousType !== "SELL_RESONANCE" && next.sellers15m >= 3) return "SELL_RESONANCE";
  if (previousScore < strongThreshold && next.score >= strongThreshold) return "STRONG_SIGNAL";
  if (previousScore < buyThreshold && next.score >= buyThreshold && (next.signalType === "BUY_RESONANCE" || next.signalType === "ACCELERATION")) return "BUY_SIGNAL";
  return null;
}

export async function sendTelegram(env: Env, state: RadarState, reason: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const icon = reason === "REVERSAL" || reason === "SELL_RESONANCE" ? "🔴" : reason === "STRONG_SIGNAL" ? "🔥" : "🟢";
  const text = [
    `${icon} ${reason.replaceAll("_", " ")}`,
    "",
    `${state.symbol} · ${state.chain}`,
    `Score ${state.score}/100`,
    `Buyers 5m ${state.buyers5m} · 15m ${state.buyers15m} · 1h ${state.buyers60m}`,
    `Sellers 15m ${state.sellers15m}`,
    `15m Net ${money(state.netFlow15m)}`,
    state.liquidityUsd == null ? null : `Liquidity ${money(state.liquidityUsd)}`,
    `Top traders ${state.topTraders}`,
    state.flags.length ? `Flags: ${state.flags.join(", ")}` : null,
    "",
    state.tokenAddress
  ].filter(Boolean).join("\n");

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error(`Telegram ${response.status}: ${(await response.text()).slice(0, 300)}`);
}
