"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ios = isIos();

  useEffect(() => {
    setInstalled(isStandalone());

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || (!installPrompt && !ios)) return null;

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      setInstallPrompt(null);
      return;
    }

    if (ios) setShowIosHelp(true);
  };

  return (
    <>
      <div className="fixed bottom-[max(5.75rem,env(safe-area-inset-bottom))] left-3 z-40 flex items-center gap-1 rounded-2xl border border-white/10 bg-[#12161a]/95 p-1.5 shadow-2xl backdrop-blur-xl lg:bottom-5">
        <button
          type="button"
          onClick={() => void install()}
          className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-white hover:bg-white/[0.06]"
        >
          {ios ? <Share size={15} /> : <Download size={15} />}
          {ios ? "添加到主屏幕" : "安装 App"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-white/[0.05] hover:text-white"
          aria-label="Dismiss install prompt"
        >
          <X size={14} />
        </button>
      </div>

      {showIosHelp && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/65 p-3 backdrop-blur-sm">
          <div className="w-full rounded-3xl border border-white/10 bg-[#12161a] p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">安装 X Video Vault</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  在 Safari 底部工具栏点击
                  <span className="mx-1 font-semibold text-white">分享</span>
                  ，然后选择
                  <span className="mx-1 font-semibold text-white">
                    添加到主屏幕
                  </span>
                  。安装后会以独立 App 窗口打开。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400"
                aria-label="Close instructions"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
