"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (element?: HTMLElement) => Promise<void> | void;
      };
    };
  }
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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const renderEmbed = useCallback(async () => {
    if (!active || !container.current || !window.twttr?.widgets) return;
    try {
      await window.twttr.widgets.load(container.current);
      setLoaded(true);
    } catch {
      setFailed(true);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      setLoaded(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      if (!loaded) setFailed(true);
    }, 12_000);
    void renderEmbed();
    return () => window.clearTimeout(timeout);
  }, [active, loaded, renderEmbed, url]);

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
        strategy="lazyOnload"
        onLoad={() => void renderEmbed()}
        onError={() => setFailed(true)}
      />
      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="animate-spin text-zinc-600" size={24} />
        </div>
      )}
      <div ref={container} className="x-embed-frame mx-auto w-full max-w-[550px]">
        <blockquote
          className="twitter-tweet"
          data-theme="dark"
          data-dnt="true"
          data-conversation="none"
          data-align="center"
        >
          <a href={url}>View this Post on X</a>
        </blockquote>
      </div>
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
