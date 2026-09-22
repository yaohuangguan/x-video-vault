"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ExternalLink,
  LoaderCircle,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
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
  preload = false,
  reelMode = false,
  theaterMode = false,
  showViewOnX = true,
  className = "",
}: {
  postId: string;
  url: string;
  active?: boolean;
  preload?: boolean;
  reelMode?: boolean;
  theaterMode?: boolean;
  showViewOnX?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const singleTapTimer = useRef<number | null>(null);
  const lastTap = useRef({ time: 0, x: 0 });
  const skipTimer = useRef<number | null>(null);
  const [media, setMedia] = useState<NativeMedia | null>(null);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(active || preload);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [skipFeedback, setSkipFeedback] = useState<number | null>(null);

  const shouldLoad = active || preload;
  const progress = useMemo(
    () => (duration > 0 ? Math.min(1, currentTime / duration) : 0),
    [currentTime, duration],
  );

  useEffect(() => {
    let cancelled = false;

    setMedia(null);
    setFallback(false);
    setCurrentTime(0);
    setDuration(0);

    if (!shouldLoad) {
      setLoading(false);
      return;
    }

    setLoading(true);

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
    };
  }, [postId, shouldLoad]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media || !reelMode) return;

    if (!active) {
      video.pause();
      setPaused(true);
      return;
    }

    const start = async () => {
      try {
        video.muted = muted;
        await video.play();
        setPaused(false);
      } catch {
        try {
          video.muted = true;
          setMuted(true);
          await video.play();
          setPaused(false);
        } catch {
          setPaused(true);
        }
      }
    };

    void start();
  }, [active, media, muted, reelMode]);

  useEffect(() => {
    if (active) return;
    videoRef.current?.pause();
    setPaused(true);
  }, [active]);

  const togglePlayback = () => {
    if (!reelMode) return;
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().then(() => setPaused(false)).catch(() => {});
    } else {
      video.pause();
      setPaused(true);
    }
  };

  const skipBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;

    const next = Math.max(
      0,
      Math.min(video.duration, video.currentTime + seconds),
    );
    video.currentTime = next;
    setCurrentTime(next);
    setSkipFeedback(seconds);

    if (skipTimer.current) window.clearTimeout(skipTimer.current);
    skipTimer.current = window.setTimeout(() => {
      setSkipFeedback(null);
      skipTimer.current = null;
    }, 650);
  };

  const handleReelPointerUp = (
    event: ReactPointerEvent<HTMLVideoElement>,
  ) => {
    if (!reelMode) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const now = Date.now();
    const previous = lastTap.current;
    const isDoubleTap =
      now - previous.time < 280 && Math.abs(x - previous.x) < 96;

    if (isDoubleTap) {
      if (singleTapTimer.current) {
        window.clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastTap.current = { time: 0, x: 0 };
      skipBy(x < rect.width / 2 ? -10 : 10);
      return;
    }

    lastTap.current = { time: now, x };
    if (singleTapTimer.current) window.clearTimeout(singleTapTimer.current);
    singleTapTimer.current = window.setTimeout(() => {
      togglePlayback();
      singleTapTimer.current = null;
    }, 260);
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    const next = !muted;
    setMuted(next);
    if (video) {
      video.muted = next;
      if (active && video.paused) {
        void video.play().then(() => setPaused(false)).catch(() => {});
      }
    }
  };

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;

    video.currentTime = Math.max(0, Math.min(video.duration, value * video.duration));
    setCurrentTime(video.currentTime);
  };

  if (!shouldLoad) {
    return (
      <div
        className={`flex min-h-80 items-center justify-center bg-black ${className}`}
      >
        <LoaderCircle className="animate-spin text-zinc-700" size={24} />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden bg-black ${
        reelMode || theaterMode ? "h-full min-h-0" : "min-h-80"
      } ${className}`}
    >
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <LoaderCircle className="animate-spin text-zinc-500" size={26} />
        </div>
      )}

      {media ? (
        <div
          className={`relative flex w-full items-center justify-center overflow-hidden bg-black ${
            reelMode || theaterMode ? "h-full" : "min-h-80"
          }`}
        >
          {reelMode && media.poster && (
            <div
              aria-hidden
              className="absolute inset-[-4%] scale-110 bg-cover bg-center opacity-25 blur-3xl"
              style={{ backgroundImage: `url("${media.poster}")` }}
            />
          )}

          <video
            ref={videoRef}
            controls={!reelMode}
            playsInline
            preload={reelMode ? "auto" : "metadata"}
            poster={media.poster ?? undefined}
            loop={reelMode}
            muted={muted}
            onPointerUp={reelMode ? handleReelPointerUp : undefined}
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration || 0);
              if (reelMode && active) {
                void event.currentTarget.play().catch(() => {});
              }
            }}
            onTimeUpdate={(event) =>
              setCurrentTime(event.currentTarget.currentTime || 0)
            }
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            onError={() => {
              setMedia(null);
              setFallback(true);
            }}
            className={`relative z-10 w-full bg-black object-contain ${
              reelMode || theaterMode
                ? "h-full max-h-none"
                : "max-h-[90dvh]"
            }`}
          >
            {media.sources.map((source) => (
              <source key={source.src} src={source.src} type={source.type} />
            ))}
          </video>

          {(reelMode || theaterMode) && (
            <>
              <button
                type="button"
                onClick={() => skipBy(-10)}
                className={`absolute left-[18%] top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-md transition active:scale-95 ${
                  reelMode ? "opacity-75" : "opacity-0 hover:opacity-100"
                }`}
                aria-label="Rewind 10 seconds"
              >
                <span className="relative">
                  <RotateCcw size={24} />
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
                    10
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => skipBy(10)}
                className={`absolute right-[18%] top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-md transition active:scale-95 ${
                  reelMode ? "opacity-75" : "opacity-0 hover:opacity-100"
                }`}
                aria-label="Forward 10 seconds"
              >
                <span className="relative">
                  <RotateCw size={24} />
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
                    10
                  </span>
                </span>
              </button>

              {skipFeedback !== null && (
                <div className="pointer-events-none absolute left-1/2 top-[42%] z-40 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md">
                  {skipFeedback > 0 ? "+" : ""}
                  {skipFeedback}s
                </div>
              )}
            </>
          )}

          {reelMode && paused && (
            <button
              type="button"
              onClick={togglePlayback}
              className="absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md"
              aria-label="Play video"
            >
              <Play size={30} fill="currentColor" className="translate-x-0.5" />
            </button>
          )}

          {reelMode && (
            <>
              <button
                type="button"
                onClick={toggleMuted}
                className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>

              <input
                aria-label="Video progress"
                type="range"
                min={0}
                max={1000}
                value={Math.round(progress * 1000)}
                onChange={(event) => seek(Number(event.target.value) / 1000)}
                className="reel-progress absolute inset-x-0 bottom-0 z-40 h-4 w-full cursor-pointer"
              />
            </>
          )}
        </div>
      ) : fallback ? (
        <XPostEmbed url={url} active={active} />
      ) : null}

      {showViewOnX && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 z-30 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-3 text-xs font-semibold text-white shadow-lg backdrop-blur hover:bg-black/85"
        >
          <ExternalLink size={14} />
          View on X
        </a>
      )}
    </div>
  );
}
