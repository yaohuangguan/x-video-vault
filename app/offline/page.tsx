export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080a0c] px-6 text-white">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300 text-2xl font-bold text-[#071014]">
          ▶
        </div>
        <h1 className="text-xl font-semibold">当前处于离线状态</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          X Video Vault 已安装，但视频和你的私有媒体库需要联网访问。
          恢复网络后重新打开即可继续。
        </p>
        <a
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black"
        >
          重试
        </a>
      </div>
    </main>
  );
}
