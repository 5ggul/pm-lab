"use client";

import { useMemo, useState } from "react";
import type { HistoryPoint } from "@/lib/types";

const windows = [
  { key: "24H", hours: 24 },
  { key: "7D", hours: 168 },
  { key: "30D", hours: 720 },
  { key: "90D", hours: 2160 },
] as const;

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
  const newest = ordered.length
    ? new Date(ordered[ordered.length - 1].at).getTime()
    : 0;
  const oldest = ordered.length ? new Date(ordered[0].at).getTime() : 0;
  const availableHours =
    ordered.length > 1 ? (newest - oldest) / 3_600_000 : 0;
  const defaultKey = availableHours >= 24 ? "24H" : "7D";
  const [period, setPeriod] = useState(defaultKey);

  const visible = useMemo(() => {
    const window = windows.find((item) => item.key === period);
    if (!window || !newest) return ordered;
    const cutoff = newest - window.hours * 3_600_000;
    return ordered.filter((point) => new Date(point.at).getTime() >= cutoff);
  }, [ordered, period, newest]);

  const values = visible
    .filter((point) => point.playing != null)
    .map((point) => point.playing!);

  if (values.length < 2) {
    return (
      <div className="chart-empty">
        <strong>데이터 수집 중</strong>
        <p>
          실제 Snapshot이 쌓이면 24시간부터 차례대로 그래프가 열립니다.
          결측 구간은 0으로 채우지 않습니다.
        </p>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const minTime = new Date(visible[0].at).getTime();
  const maxTime = new Date(visible[visible.length - 1].at).getTime();
  const timeRange = Math.max(1, maxTime - minTime);
  const expectedMs = Math.max(1, expectedIntervalMinutes) * 60_000;

  let path = "";
  let segmentOpen = false;
  let previousTime: number | null = null;

  for (const point of visible) {
    const time = new Date(point.at).getTime();
    if (!Number.isFinite(time) || point.playing == null) {
      segmentOpen = false;
      previousTime = null;
      continue;
    }

    const hasMissingGap =
      previousTime != null && time - previousTime > expectedMs * 1.5;
    if (hasMissingGap) segmentOpen = false;

    const x = ((time - minTime) / timeRange) * 100;
    const y = 42 - ((point.playing - min) / range) * 36;
    path += `${segmentOpen ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)} `;
    segmentOpen = true;
    previousTime = time;
  }

  const updateTime = updateAt ? new Date(updateAt).getTime() : NaN;
  const updateX =
    Number.isFinite(updateTime) && updateTime >= minTime && updateTime <= maxTime
      ? ((updateTime - minTime) / timeRange) * 100
      : null;

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
        <button disabled>
          ALL<span className="sr-only"> 데이터 수집 중</span>
        </button>
      </div>

      <svg
        className="history-chart"
        viewBox="0 0 100 48"
        role="img"
        aria-label={`플레이 인원 ${period} 변화 그래프. 수집 누락 구간은 선이 끊겨 표시됩니다.`}
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
            <title>Roblox 공개 데이터의 최근 게임 업데이트 시각</title>
          </line>
        )}
        <path d={path.trim()} />
      </svg>

      <div className="chart-range">
        <span>{min.toLocaleString("ko-KR")}</span>
        <span>{max.toLocaleString("ko-KR")}</span>
      </div>

      <details className="accessible-data">
        <summary>차트 데이터 표로 보기</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>시각</th>
                <th>플레이 인원</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((point, index) => (
                <tr key={index}>
                  <td>{new Date(point.at).toLocaleString("ko-KR")}</td>
                  <td>
                    {point.playing == null
                      ? "결측"
                      : point.playing.toLocaleString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
