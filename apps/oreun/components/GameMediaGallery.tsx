"use client";

import { useState } from "react";
import type { GameMediaImage, GameMediaVideo } from "@/lib/types";

type Item =
  | { type: "image"; position: number; image: GameMediaImage }
  | { type: "video"; position: number; video: GameMediaVideo };

export default function GameMediaGallery({
  universeId,
  heroImageUrl,
  images,
  videos,
}: {
  universeId: number;
  heroImageUrl?: string | null;
  images: GameMediaImage[];
  videos: GameMediaVideo[];
}) {
  const [modal, setModal] = useState<
    | { type: "image"; url: string }
    | { type: "video"; poster: string | null; url: string | null; loading: boolean; error?: string }
    | null
  >(null);

  const items: Item[] = [
    ...images.map((image) => ({ type: "image" as const, position: image.position, image })),
    ...videos.map((video) => ({ type: "video" as const, position: video.position, video })),
  ].sort((a, b) => a.position - b.position);

  async function openVideo(video: GameMediaVideo) {
    setModal({
      type: "video",
      poster: video.posterUrl ?? heroImageUrl ?? null,
      url: null,
      loading: true,
    });

    try {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
      if (!base) throw new Error("media resolver unavailable");
      const response = await fetch(
        `${base}/functions/v1/r1-game-media?universeId=${universeId}&videoId=${video.assetId}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`video ${response.status}`);
      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new Error("video location missing");
      setModal({
        type: "video",
        poster: video.posterUrl ?? heroImageUrl ?? null,
        url: payload.url,
        loading: false,
      });
    } catch (error) {
      setModal({
        type: "video",
        poster: video.posterUrl ?? heroImageUrl ?? null,
        url: null,
        loading: false,
        error: error instanceof Error ? error.message : "video unavailable",
      });
    }
  }

  if (!items.length) return null;

  return (
    <>
      <div className="media-gallery">
        {items.slice(0, 10).map((item, index) => {
          if (item.type === "video") {
            const poster = item.video.posterUrl ?? heroImageUrl;
            return (
              <button
                key={`video-${item.video.assetId}`}
                className="media-tile media-video"
                type="button"
                onClick={() => openVideo(item.video)}
              >
                {poster && <img src={poster} alt="" loading="lazy" />}
                <span className="media-play">▶</span>
                <small>VIDEO</small>
              </button>
            );
          }

          return (
            <button
              key={`image-${item.image.assetId}`}
              className="media-tile"
              type="button"
              onClick={() => setModal({ type: "image", url: item.image.url })}
            >
              <img src={item.image.url} alt={item.image.altText ?? ""} loading="lazy" />
              <small>IMAGE {index + 1}</small>
            </button>
          );
        })}
      </div>

      {modal && (
        <div className="media-modal" role="dialog" aria-modal="true">
          <button className="media-modal-close" type="button" onClick={() => setModal(null)}>
            ×
          </button>
          <div className="media-modal-body">
            {modal.type === "image" ? (
              <img src={modal.url} alt="" />
            ) : modal.loading ? (
              <div className="media-loading">영상 불러오는 중…</div>
            ) : modal.url ? (
              <video controls autoPlay playsInline poster={modal.poster ?? undefined} src={modal.url} />
            ) : (
              <div className="media-loading">영상을 불러오지 못했습니다. {modal.error}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
