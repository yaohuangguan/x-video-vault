"use client";

import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";

const postUrl =
  /https?:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/[^\s]+\/status\/\d+/i;

export default function ShareTarget() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const combined = [
      params.get("url"),
      params.get("text"),
      params.get("title"),
    ]
      .filter(Boolean)
      .join(" ");
    const match = combined.match(postUrl);
    if (match) window.localStorage.setItem("xvv_pending_share", match[0]);
    window.location.replace("/?share=1");
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080a0c] text-zinc-400">
      <div className="flex items-center gap-3 text-sm">
        <LoaderCircle className="animate-spin text-cyan-300" size={18} />
        正在发送到 X Video Vault…
      </div>
    </main>
  );
}
