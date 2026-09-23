"use client";

import { useMemo, useState } from "react";
import type { HistoryPoint } from "@/lib/types";

const COVERAGE_MIN = 0.7;
const windows = [
  { key: "6H", hours: 6 },
  { key: "24H", hours: 24 },
  { key: "7D", hours: 168 },
  { key: "30D", hours: 720 },
  { key: "90D", hours: 2160 },
] as const;

function trusted(point: HistoryPoint) {
  return (
    point.playing != null &&
    point.coverageRatio != null &&
    point.coverageRatio >= COVERAGE_MIN
  );
}

function formatCount(value: number) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatKstMinute(iso: string) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "—";
  const date = new Date(time + 9 * 60 * 60 * 1000);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

export default function HistoryChart({
  points,
  expectedIntervalMinutes = 60,
  updateAt,
}: {
  points: HistoryPoint[];
  expectedIntervalMinutes?: number;
  updateAt?: string | null;
}) {
  const ordered = useMemo(
    () =>
      [...points].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
      ),
    [points],
  );

  const trustedOrdered = useMemo(
    () => ordered.filter(trusted),
    [ordered],
  );

  const newest = trustedOrdered.length
    ? new Date(trustedOrdered[trustedOrdered.length - 1].at).getTime()
    : 0;
  const oldest = trustedOrdered.length
    ? new Date(trustedOrdered[0].at).getTime()
    : 0;
  const availableHours =
    trustedOrdered.length > 1 ? (newest - oldest) / 3_600_000 : 0;
  const defaultKey =
    availableHours >= 24 ? "24H" : availableHours >= 6 ? "6H" : "24H";
  const [period, setPeriod] = useState<(typeof windows)[number]["key"]>(
    defaultKey,
  );

  const activeWindow =
    windows.find((item) => item.key === period) ?? windows[1];

  const visible = useMemo(() => {
    if (!newest) return ordered;
    const cutoff = newest - activeWindow.hours * 3_600_000;
    return ordered.filter((point) => new Date(point.at).getTime() >= cutoff);
  }, [activeWindow.hours, newest, ordered]);

  const trustedVisible = visible.filter(trusted);
  const values = trustedVisible.map((point) => point.playing!);
  const lowCoverageCount = visible.filter(
    (point) =>
      point.playing != null &&
      (point.coverageRatio == null || point.coverageRatio < COVERAGE_MIN),
  ).length;

  if (values.length < 2) {
    return (
      <div className="chart-empty">
        <strong>수집 중</strong>
        <p>
          신뢰 가능한 관측 구간이 더 쌓이면 그래프가 열립니다. 수집 신뢰도
          70% 미만 구간은 정상 추이선에 넣지 않습니다.
        </p>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const current = values[values.length - 1];
  const average = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
  const averageCoverage =
    trustedVisible.reduce(
      (sum, point) => sum + (point.coverageRatio ?? 0),
      0,
    ) / trustedVisible.length;

  const range = Math.max(1, max - min);
  const minTime = new Date(visible[0].at).getTime();
  const maxTime = new Date(visible[visible.length - 1].at).getTime();
  const timeRange = Math.max(1, maxTime - minTime);
  const expectedMs = Math.max(1, expectedIntervalMinutes) * 60_000;

  let path = "";
  let segmentOpen = false;
  let previousTrustedTime: number | null = null;

  for (const point of visible) {
    const time = new Date(point.at).getTime();
    if (!Number.isFinite(time) || !trusted(point)) {
      segmentOpen = false;
      previousTrustedTime = null;
      continue;
    }

    const hasMissingGap =
      previousTrustedTime != null &&
      time - previousTrustedTime > expectedMs * 1.5;
    if (hasMissingGap) segmentOpen = false;

    const x = ((time - minTime) / timeRange) * 100;
    const y = 42 - ((point.playing! - min) / range) * 36;
    path += `${segmentOpen ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)} `;
    segmentOpen = true;
    previousTrustedTime = time;
  }

  const updateTime = updateAt ? new Date(updateAt).getTime() : NaN;
  const updateX =
    Number.isFinite(updateTime) && updateTime >= minTime && updateTime <= maxTime
      ? ((updateTime - minTime) / timeRange) * 100
      : null;

  const startLabel = formatKstMinute(visible[0].at);
  const endLabel = formatKstMinute(visible[visible.length - 1].at);

  return (
    <div className="chart-card">
      <div className="chart-tabs" aria-label="차트 기간">
        {windows.map((window) => {
          const enabled = availableHours >= window.hours * 0.8;
          return (
            <button
              key={window.key}
              disabled={!enabled}
              className={period === window.key ? "active" : ""}
              onClick={() => setPeriod(window.key)}
            >
              {window.key}
              {!enabled && <span className="sr-only"> 데이터 수집 중</span>}
            </button>
          );
        })}
      </div>

      <div className="chart-summary" aria-label="선택 기간 통계">
        <div>
          <small>마지막 관측</small>
          <strong>{formatCount(current)}</strong>
        </div>
        <div>
          <small>최저</small>
          <strong>{formatCount(min)}</strong>
        </div>
        <div>
          <small>최고</small>
          <strong>{formatCount(max)}</strong>
        </div>
        <div>
          <small>평균</small>
          <strong>{formatCount(average)}</strong>
        </div>
      </div>

      <svg
        className="history-chart"
        viewBox="0 0 100 48"
        role="img"
        aria-label={`플레이 인원 ${period} 변화. 수집 신뢰도 70% 이상 관측값만 연결합니다.`}
        preserveAspectRatio="none"
      >
        <line x1="0" y1="42" x2="100" y2="42" />
        <line x1="0" y1="24" x2="100" y2="24" />
        <line x1="0" y1="6" x2="100" y2="6" />
        {updateX != null && (
          <line
            className="update-marker"
            x1={updateX}
            y1="4"
            x2={updateX}
            y2="43"
          >
            <title>Roblox 공개 데이터의 최근 업데이트 시각</title>
          </line>
        )}
        <path d={path.trim()} />
      </svg>

      <div className="chart-axis">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
      <div className="chart-quality">
        관측 {trustedVisible.length}개 · 평균 수집 신뢰도{" "}
        {Math.round(averageCoverage * 100)}%
        {lowCoverageCount > 0
          ? ` · 신뢰도 낮은 관측 ${lowCoverageCount}개 제외`
          : ""}
      </div>

      <details className="accessible-data">
        <summary>관측값 보기</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>시각</th>
                <th>플레이 인원</th>
                <th>수집 신뢰도</th>
                <th>그래프</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((point, index) => (
                <tr key={index}>
                  <td>
                    {formatKstMinute(point.at)}
                  </td>
                  <td>
                    {point.playing == null
                      ? "결측"
                      : formatCount(point.playing)}
                  </td>
                  <td>
                    {point.coverageRatio == null
                      ? "—"
                      : `${Math.round(point.coverageRatio * 100)}%`}
                  </td>
                  <td>{trusted(point) ? "사용" : "제외"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
