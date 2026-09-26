"use client";

import { useEffect, useMemo, useState } from "react";

export default function ResilientGameImage({
  sources = [],
  name,
  alt = "",
  className = "",
  width = 768,
  height = 432,
  eager = false,
  fetchPriority = "auto",
}: {
  sources?: Array<string | null | undefined>;
  name: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  eager?: boolean;
  fetchPriority?: "high" | "low" | "auto";
}) {
  const usable = useMemo(
    () => Array.from(new Set(sources.filter((value): value is string => Boolean(value)))),
    [sources],
  );
  const sourceKey = usable.join("|");
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [sourceKey]);

  const src = usable[index];
  if (!src) {
    const short = name.replace(/\s+/g, "").slice(0, 3) || "RJ";
    return (
      <div className={"game-image-fallback " + className} aria-hidden="true">
        <span className="game-image-fallback-mark">RJ</span>
        <span className="game-image-fallback-name">{short}</span>
        <i aria-hidden="true"/>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={fetchPriority}
      decoding="async"
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
