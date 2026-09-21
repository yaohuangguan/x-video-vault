"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Heart, X } from "lucide-react";
import type { VaultItem } from "@/lib/ui-types";
import { XVideoPlayer } from "@/components/x-video-player";

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
      }).format(new Date(value))
    : "日期未知";

function Avatar({ src, label }: { src?: string | null; label: string }) {
  return src ? (
    <Image
      src={src}
      alt=""
      width={40}
      height={40}
      unoptimized
      className="h-10 w-10 rounded-full object-cover ring-1 ring-white/20"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-xs font-semibold text-cyan-100">
      {label.slice(0, 1).toUpperCase()}
    </div>
  );
}

function ReelSlide({
  item,
  onFavorite,
  onActive,
}: {
  item: VaultItem;
  onFavorite: () => void;
  onActive: () => void;
}) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [nearby, setNearby] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    const node = section.current;
    if (!node) return;

    const activeObserver = new IntersectionObserver(
      ([entry]) =>
        setActive(entry.isIntersecting && entry.intersectionRatio >= 0.72),
      { threshold: [0.25, 0.5, 0.72, 0.9] },
    );

    const preloadObserver = new IntersectionObserver(
      ([entry]) => setNearby(entry.isIntersecting),
      {
        threshold: 0.01,
        rootMargin: "100% 0px 100% 0px",
      },
    );

    activeObserver.observe(node);
    preloadObserver.observe(node);

    return () => {
      activeObserver.disconnect();
      preloadObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!active || reported.current) return;
    reported.current = true;
    onActive();
  }, [active, onActive]);

  return (
    <section
      ref={section}
      data-post-id={item.postId}
      className="relative h-dvh snap-start snap-always overflow-hidden bg-black"
    >
      <div className="absolute inset-0">
        <XVideoPlayer
          postId={item.postId}
          url={item.originalUrl}
          active={active}
          preload={nearby}
          reelMode
          showViewOnX={false}
          className="h-full"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/95 via-black/55 to-transparent" />

      <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 right-20 z-30">
        <div className="mb-3 flex items-center gap-2.5">
          <Avatar
            src={item.author?.profileImageUrl}
            label={item.author?.username ?? "X"}
          />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-white">
              {item.author?.displayName ?? "X Post"}
            </div>
            <div className="truncate text-xs text-white/60">
              @{item.author?.username ?? "unknown"} · {formatDate(item.createdAt)}
            </div>
          </div>
        </div>

        {item.text && (
          <p className="line-clamp-3 max-w-[92%] text-[15px] leading-6 text-white/92">
            {item.text}
          </p>
        )}

        {item.tags.length > 0 && (
          <div className="mt-2 flex max-w-[90%] flex-wrap gap-1.5">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-[max(2.25rem,env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-center gap-3">
        <button
          onClick={onFavorite}
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition active:scale-95 ${
            item.isFavorite ? "text-rose-400" : "text-white"
          }`}
          aria-label="Favorite"
        >
          <Heart
            size={24}
            fill={item.isFavorite ? "currentColor" : "none"}
          />
        </button>

        <a
          href={item.originalUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition active:scale-95"
          aria-label="View on X"
        >
          <ExternalLink size={21} />
        </a>
      </div>
    </section>
  );
}

export function MobileReelViewer({
  items,
  initialId,
  onClose,
  onFavorite,
  onViewed,
}: {
  items: VaultItem[];
  initialId: string;
  onClose: () => void;
  onFavorite: (item: VaultItem) => void;
  onViewed: (item: VaultItem) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = scroller.current?.querySelector<HTMLElement>(
      `[data-post-id="${initialId}"]`,
    );

    requestAnimationFrame(() => {
      target?.scrollIntoView({ block: "start" });
    });
  }, [initialId, items]);

  return (
    <div className="fixed inset-0 z-50 bg-black lg:hidden">
      <div className="pointer-events-none fixed inset-x-0 top-[max(.9rem,env(safe-area-inset-top))] z-[60] flex items-center justify-center">
        <div className="rounded-full bg-black/30 px-3 py-1.5 text-xs font-medium tracking-wide text-white/70 backdrop-blur-md">
          X Video Vault
        </div>
      </div>

      <button
        onClick={onClose}
        className="fixed right-4 top-[max(.85rem,env(safe-area-inset-top))] z-[70] flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
        aria-label="Close viewer"
      >
        <X size={21} />
      </button>

      <div
        ref={scroller}
        className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-none"
      >
        {items.map((item) => (
          <ReelSlide
            key={item.postId}
            item={item}
            onFavorite={() => onFavorite(item)}
            onActive={() => onViewed(item)}
          />
        ))}
      </div>
    </div>
  );
}
