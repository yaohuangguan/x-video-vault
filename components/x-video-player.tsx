"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { XPostEmbed } from "@/components/x-post-embed";

type NativeMedia = {
  available: true;
  poster?: string | null;
  aspectRatio?: number[] | null;
  sources: Array<{
    type: string;
    src: string;
    bitrate?: number;
  }>;
};

type MediaResponse =
  | NativeMedia
  | {
      available: false;
      reason?: string;
    };

export function XVideoPlayer({
  postId,
  url,
  active = true,
  className = "",
}: {
  postId: string;
  url: string;
  active?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [media, setMedia] = useState<NativeMedia | null>(null);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(active);

  useEffect(() => {
    let cancelled = false;

    if (!active) {
      videoRef.current?.pause();
      setLoading(false);
      return;
    }

    setLoading(true);
    setFallback(false);

    void fetch(`/api/media?postId=${encodeURIComponent(postId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as MediaResponse;
        if (cancelled) return;

        if (response.ok && result.available && result.sources?.length) {
          setMedia(result);
          setFallback(false);
        } else {
          setMedia(null);
          setFallback(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMedia(null);
          setFallback(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      videoRef.current?.pause();
    };
  }, [active, postId]);

  if (!active) {
    return (
      <div
        className={`flex min-h-80 items-center justify-center rounded-2xl bg-white/[0.025] ${className}`}
      >
        <LoaderCircle className="animate-spin text-zinc-600" size={24} />
      </div>
    );
  }

  return (
    <div className={`relative min-h-80 w-full ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
          <LoaderCircle className="animate-spin text-zinc-500" size={26} />
        </div>
      )}

      {media ? (
        <div className="flex min-h-80 w-full items-center justify-center bg-black">
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={media.poster ?? undefined}
            className="max-h-[82dvh] w-full bg-black object-contain"
            onError={() => {
              setMedia(null);
              setFallback(true);
            }}
          >
            {media.sources.map((source) => (
              <source key={source.src} src={source.src} type={source.type} />
            ))}
          </video>
        </div>
      ) : fallback ? (
        <XPostEmbed url={url} active={active} />
      ) : null}

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="absolute right-3 top-3 z-20 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-3 text-xs font-semibold text-white shadow-lg backdrop-blur hover:bg-black/85"
      >
        <ExternalLink size={14} />
        View on X
      </a>
    </div>
  );
}
