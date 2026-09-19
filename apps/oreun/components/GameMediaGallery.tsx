"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameMediaImage, GameMediaVideo } from "@/lib/types";

type Item =
  | { type: "image"; position: number; image: GameMediaImage }
  | { type: "video"; position: number; video: GameMediaVideo };

type ModalState =
  | { type: "image"; url: string }
  | { type: "youtube"; youtubeId: string }
  | {
      type: "video";
      poster: string | null;
      url: string | null;
      loading: boolean;
      error?: string;
    };

export default function GameMediaGallery({
  universeId,
  heroImageUrl,
  robloxUrl,
  images,
  videos,
}: {
  universeId: number;
  heroImageUrl?: string | null;
  robloxUrl: string;
  images: GameMediaImage[];
  videos: GameMediaVideo[];
}) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const items = useMemo<Item[]>(() => {
    const posterAssetIds = new Set(
      videos
        .map((video) => video.posterAssetId)
        .filter((id): id is number => Number.isFinite(id)),
    );

    return [
      ...videos.map((video) => ({
        type: "video" as const,
        position: video.position,
        video,
      })),
      ...images
        .filter((image) => !posterAssetIds.has(image.assetId))
        .map((image) => ({
          type: "image" as const,
          position: image.position,
          image,
        })),
    ].sort((a, b) => a.position - b.position);
  }, [images, videos]);

  function closeModal() {
    setModal(null);
    setPlaybackFailed(false);
    queueMicrotask(() => previousFocusRef.current?.focus());
  }

  useEffect(() => {
    if (!modal) return;
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>(".media-modal-body");
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],video[controls],iframe,[tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [modal]);

  function rememberFocus() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }

  function openVideo(video: GameMediaVideo) {
    rememberFocus();
    setPlaybackFailed(false);

    if (
      video.provider === "youtube" &&
      video.youtubeId &&
      /^[A-Za-z0-9_-]{6,20}$/.test(video.youtubeId)
    ) {
      setModal({ type: "youtube", youtubeId: video.youtubeId });
      return;
    }

    if (video.assetId == null) {
      setModal({
        type: "video",
        poster: video.posterUrl ?? heroImageUrl ?? null,
        url: null,
        loading: false,
        error: "video asset missing",
      });
      return;
    }

    setModal({
      type: "video",
      poster: video.posterUrl ?? heroImageUrl ?? null,
      url:
        "/api/media/video?stream=1&universeId=" +
        encodeURIComponent(String(universeId)) +
        "&videoId=" +
        encodeURIComponent(String(video.assetId)),
      loading: false,
    });
  }

  function openImage(url: string) {
    rememberFocus();
    setModal({ type: "image", url });
  }

  if (!items.length) return null;

  return (
    <>
      <div className="media-gallery">
        {items.map((item, index) => {
          if (item.type === "video") {
            const poster = item.video.posterUrl ?? heroImageUrl;
            return (
              <button
                key={
                  item.video.provider === "youtube"
                    ? `youtube-${item.video.youtubeId}`
                    : `video-${item.video.assetId}`
                }
                className="media-tile media-video"
                type="button"
                onClick={() => openVideo(item.video)}
                aria-label="게임 공식 영상 열기"
              >
                {poster && (
                  <img
                    src={poster}
                    alt=""
                    loading="lazy"
                    width={768}
                    height={432}
                  />
                )}
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
              onClick={() => openImage(item.image.url)}
              aria-label={`공식 이미지 ${index + 1} 크게 보기`}
            >
              <img
                src={item.image.url}
                alt={item.image.altText ?? ""}
                loading="lazy"
                width={768}
                height={432}
              />
              <small>IMAGE {index + 1}</small>
            </button>
          );
        })}
      </div>

      {modal && (
        <div
          className="media-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            className="media-modal-body"
            role="dialog"
            aria-modal="true"
            aria-label={modal.type === "image" ? "공식 게임 이미지" : "공식 게임 영상"}
          >
            <button
              ref={closeButtonRef}
              className="media-modal-close"
              type="button"
              onClick={closeModal}
              aria-label="닫기"
            >
              ×
            </button>

            {modal.type === "image" ? (
              <img src={modal.url} alt="" width={768} height={432} />
            ) : modal.type === "youtube" ? (
              <iframe
                className="media-youtube"
                src={
                  "https://www.youtube-nocookie.com/embed/" +
                  encodeURIComponent(modal.youtubeId) +
                  "?autoplay=1"
                }
                title="공식 게임 영상"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : modal.loading ? (
              <div className="media-loading">영상 불러오는 중…</div>
            ) : modal.url ? (
              playbackFailed ? (
                <div className="media-loading">
                  <strong>이 브라우저에서 영상을 재생하지 못했습니다.</strong>
                  <a
                    className="secondary-button"
                    href={robloxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Roblox에서 보기 ↗
                  </a>
                </div>
              ) : (
                <video
                  controls
                  autoPlay
                  playsInline
                  poster={modal.poster ?? undefined}
                  onError={() => setPlaybackFailed(true)}
                >
                  <source src={modal.url} type="video/webm" />
                </video>
              )
            ) : (
              <div className="media-loading">
                <strong>영상을 불러오지 못했습니다.</strong>
                {modal.error && <span>{modal.error}</span>}
                <a
                  className="secondary-button"
                  href={robloxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Roblox에서 보기 ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
