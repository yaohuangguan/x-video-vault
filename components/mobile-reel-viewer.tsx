"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Heart,
  X,
} from "lucide-react";
import type { VaultItem } from "@/lib/ui-types";
import { XVideoPlayer } from "@/components/x-video-player";

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "日期未知";

function Avatar({ src, label }: { src?: string | null; label: string }) {
  return src ? (
    <Image
      src={src}
      alt=""
      width={36}
      height={36}
      unoptimized
      className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10"
    />
  ) : (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-cyan-200">
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
  const reported = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting && entry.intersectionRatio > 0.65),
      { threshold: [0.25, 0.65, 0.9] },
    );
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active || reported.current) return;
    reported.current = true;
    onActive();
  }, [active, onActive]);

  return (
    <section
      ref={section}
      className="relative flex h-dvh snap-start snap-always flex-col overflow-hidden bg-black"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-40 pt-[max(3.75rem,env(safe-area-inset-top))]">
        <XVideoPlayer postId={item.postId} url={item.originalUrl} active={active} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/90 to-transparent" />
      <div className="absolute bottom-[max(1.1rem,env(safe-area-inset-bottom))] left-4 right-20">
        <div className="mb-3 flex items-center gap-2.5">
          <Avatar
            src={item.author?.profileImageUrl}
            label={item.author?.username ?? "X"}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {item.author?.displayName ?? "X Post"}
            </div>
            <div className="truncate text-xs text-white/55">
              @{item.author?.username ?? "unknown"} · {formatDate(item.createdAt)}
            </div>
          </div>
        </div>
        {item.text && (
          <p className="line-clamp-2 text-[15px] leading-6 text-white/85">
            {item.text}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/75"
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute bottom-[max(1.4rem,env(safe-area-inset-bottom))] right-3 flex flex-col items-center gap-3">
        <button
          onClick={onFavorite}
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur ${item.isFavorite ? "text-rose-400" : "text-white"}`}
          aria-label="Favorite"
        >
          <Heart size={23} fill={item.isFavorite ? "currentColor" : "none"} />
        </button>
        <a
          href={item.originalUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
          aria-label="Open on X"
        >
          <ExternalLink size={21} />
        </a>
        <div className="flex flex-col items-center text-white/45">
          <ChevronUp size={17} />
          <span className="text-[10px] uppercase tracking-wider">滑动</span>
          <ChevronDown size={17} />
        </div>
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
    const index = Math.max(
      0,
      items.findIndex((item) => item.postId === initialId),
    );
    requestAnimationFrame(() =>
      scroller.current?.scrollTo({ top: index * window.innerHeight }),
    );
  }, [initialId, items]);

  return (
    <div className="fixed inset-0 z-50 bg-black lg:hidden">
      <button
        onClick={onClose}
        className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
        aria-label="Close viewer"
      >
        <X size={21} />
      </button>
      <div
        ref={scroller}
        className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain"
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
