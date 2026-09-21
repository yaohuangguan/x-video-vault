"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";

type TwitterWidgets = {
  createTweet: (
    postId: string,
    element: HTMLElement,
    options?: {
      theme?: "light" | "dark";
      dnt?: boolean;
      conversation?: "none" | "all";
      align?: "left" | "center" | "right";
    },
  ) => Promise<HTMLElement | null | undefined>;
};

declare global {
  interface Window {
    twttr?: {
      widgets?: TwitterWidgets;
    };
  }
}

const getPostId = (url: string) => url.match(/\/status\/(\d+)/i)?.[1] ?? null;

async function waitForTwitterWidgets() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const widgets = window.twttr?.widgets;
    if (widgets?.createTweet) return widgets;
    await new Promise((resolve) => window.setTimeout(resolve, 125));
  }
  return null;
}

export function XPostEmbed({
  url,
  active = true,
  className = "",
}: {
  url: string;
  active?: boolean;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const currentGeneration = ++generation.current;
    const host = container.current;

    setLoaded(false);
    setFailed(false);

    if (host) host.replaceChildren();
    if (!active || !host) return;

    const postId = getPostId(url);
    if (!postId) {
      setFailed(true);
      return;
    }

    const render = async () => {
      const widgets = await waitForTwitterWidgets();
      if (currentGeneration !== generation.current) return;

      if (!widgets) {
        setFailed(true);
        return;
      }

      try {
        const element = await Promise.race([
          widgets.createTweet(postId, host, {
            theme: "dark",
            dnt: true,
            conversation: "none",
            align: "center",
          }),
          new Promise<null>((resolve) =>
            window.setTimeout(() => resolve(null), 12_000),
          ),
        ]);

        if (currentGeneration !== generation.current) return;

        if (element || host.firstElementChild) {
          setLoaded(true);
        } else {
          setFailed(true);
        }
      } catch {
        if (currentGeneration === generation.current) setFailed(true);
      }
    };

    void render();

    return () => {
      generation.current += 1;
      host.replaceChildren();
    };
  }, [active, url]);

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
      <Script
        id="x-widgets"
        src="https://platform.twitter.com/widgets.js"
        strategy="afterInteractive"
        onError={() => setFailed(true)}
      />
      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="animate-spin text-zinc-600" size={24} />
        </div>
      )}
      <div
        ref={container}
        className="x-embed-frame mx-auto w-full max-w-[550px]"
      />
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#0c0f12] px-6 text-center">
          <p className="text-sm text-zinc-400">
            X could not load this embedded Post.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black"
          >
            <ExternalLink size={16} />
            Open on X
          </a>
        </div>
      )}
    </div>
  );
}
