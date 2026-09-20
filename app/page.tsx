"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Film,
  FolderHeart,
  Heart,
  KeyRound,
  Library,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  MonitorDown,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Smartphone,
  Tag,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MobileReelViewer } from "@/components/mobile-reel-viewer";
import { XPostEmbed } from "@/components/x-post-embed";
import type {
  AuthState,
  LibraryResponse,
  TagSummary,
  VaultItem,
} from "@/lib/ui-types";

const PAGE_SIZE = 24;
const emptyData: LibraryResponse = {
  auth: { state: "login", authenticated: false },
  items: [],
  total: 0,
  tags: [],
  lastImport: null,
  hasMore: false,
};

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "日期未知";

const formatImport = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      }).format(new Date(value))
    : "尚未导入";

export default function Home() {
  const [data, setData] = useState<LibraryResponse>(emptyData);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "favorites" | "tags">("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<VaultItem | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [initialLink, setInitialLink] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const buildParams = useCallback(
    (offset = 0) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        sort,
      });
      if (query.trim()) params.set("q", query.trim());
      if (view === "favorites") params.set("favorite", "true");
      if (activeTag) params.set("tag", activeTag);
      if (type !== "all") params.set("type", type);
      return params;
    },
    [activeTag, query, sort, type, view],
  );

  const fetchPage = useCallback(
    async (offset = 0, append = false) => {
      const response = await fetch(`/api/library?${buildParams(offset)}`);
      const result = (await response.json().catch(() => ({}))) as
        | LibraryResponse
        | { auth?: AuthState; error?: string };
      if (response.status === 401 && result.auth) {
        setAuth(result.auth);
        setData(emptyData);
        return;
      }
      if (!response.ok) {
        throw new Error("error" in result ? result.error : "无法读取视频库");
      }
      const library = result as LibraryResponse;
      setAuth(library.auth);
      setData((current) =>
        append
          ? {
              ...library,
              items: [...current.items, ...library.items],
            }
          : library,
      );
    },
    [buildParams],
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const pending = window.localStorage.getItem("xvv_pending_share");
    if (!pending) return;
    window.localStorage.removeItem("xvv_pending_share");
    setInitialLink(pending);
    setLinkOpen(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setNotice("");
      try {
        await fetchPage();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "无法读取视频库");
      } finally {
        setLoading(false);
      }
    }, query ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [fetchPage, query]);

  const refresh = useCallback(async () => {
    await fetchPage();
  }, [fetchPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      await fetchPage(data.items.length, true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFavorite = async (item: VaultItem) => {
    const next = !item.isFavorite;
    setData((current) => ({
      ...current,
      items: current.items.map((entry) =>
        entry.postId === item.postId
          ? { ...entry, isFavorite: next }
          : entry,
      ),
    }));
    if (selected?.postId === item.postId) {
      setSelected({ ...selected, isFavorite: next });
    }
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: item.postId, isFavorite: next }),
    });
  };

  const markViewed = useCallback((item: VaultItem) => {
    void fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: item.postId }),
    });
  }, []);

  const openItem = (item: VaultItem) => {
    setSelected(item);
    markViewed(item);
  };

  const stepSelected = useCallback(
    (direction: number) => {
      if (!selected) return;
      const index = data.items.findIndex(
        (item) => item.postId === selected.postId,
      );
      const next = data.items[index + direction];
      if (next) {
        setSelected(next);
        markViewed(next);
      }
    },
    [data.items, markViewed, selected],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!selected || !desktop) return;
      if (event.key === "Escape") setSelected(null);
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        stepSelected(1);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        stepSelected(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [desktop, selected, stepSelected]);

  const updateSelectedTags = async (tagIds: number[]) => {
    if (!selected) return;
    const response = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: selected.postId, tagIds }),
    });
    if (!response.ok) return;
    const tags = data.tags.filter((tag) => tagIds.includes(tag.id));
    setSelected({ ...selected, tags });
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.postId === selected.postId ? { ...item, tags } : item,
      ),
    }));
  };

  if (auth && !auth.authenticated) {
    return (
      <VaultAccess
        mode={auth.state}
        onAuthenticated={() => {
          setAuth(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0c] text-[#e9edf0] selection:bg-cyan-300/20">
      <Header
        query={query}
        setQuery={setQuery}
        onAdd={() => {
          setInitialLink("");
          setLinkOpen(true);
        }}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar
          data={data}
          view={view}
          activeTag={activeTag}
          onView={(next) => {
            setView(next);
            setActiveTag(null);
          }}
          onTag={(tag) => {
            setView("tags");
            setActiveTag(tag);
          }}
          onSettings={() => setSettingsOpen(true)}
        />
        <main className="min-w-0 flex-1 px-3 py-5 pb-28 sm:px-7 lg:px-10 lg:py-9">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-200/80">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                {formatImport(data.lastImport)}
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                {activeTag ||
                  (view === "favorites"
                    ? "Favorites"
                    : view === "tags"
                      ? "Collections"
                      : "All videos")}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500">
                {data.total} 条视频 · 元数据保存在你的 Vault
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="h-9 rounded-lg border border-white/[0.09] bg-[#101419] px-3 text-sm text-zinc-300 outline-none"
                aria-label="Media type"
              >
                <option value="all">Video + GIF</option>
                <option value="video">Video</option>
                <option value="animated_gif">GIF</option>
              </select>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-9 rounded-lg border border-white/[0.09] bg-[#101419] px-3 text-sm text-zinc-300 outline-none"
                aria-label="Sort"
              >
                <option value="newest">最新帖子</option>
                <option value="oldest">最早帖子</option>
                <option value="imported">最近采集</option>
                <option value="author">作者</option>
              </select>
            </div>
          </div>

          {notice && (
            <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200">
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}

          {loading ? (
            <CardSkeletons />
          ) : data.items.length === 0 ? (
            <EmptyState
              query={query}
              onAdd={() => {
                setInitialLink("");
                setLinkOpen(true);
              }}
              onSettings={() => setSettingsOpen(true)}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
                {data.items.map((item) => (
                  <VideoCard
                    key={item.postId}
                    item={item}
                    onOpen={() => openItem(item)}
                    onFavorite={() => void toggleFavorite(item)}
                  />
                ))}
              </div>
              {data.hasMore && (
                <div className="mt-10 flex justify-center">
                  <Button
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    variant="outline"
                    className="rounded-xl border-white/[0.1] bg-transparent text-zinc-300 hover:bg-white/[0.05]"
                  >
                    {loadingMore && <LoaderCircle className="animate-spin" />}
                    加载更多
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <MobileNavigation
        view={view}
        activeTag={activeTag}
        onView={(next) => {
          setView(next);
          setActiveTag(null);
        }}
      />

      {selected && !desktop && (
        <MobileReelViewer
          items={data.items}
          initialId={selected.postId}
          onClose={() => setSelected(null)}
          onFavorite={(item) => void toggleFavorite(item)}
          onViewed={markViewed}
        />
      )}
      {desktop && (
        <DesktopViewer
          selected={selected}
          allTags={data.tags}
          onClose={() => setSelected(null)}
          onStep={stepSelected}
          onFavorite={(item) => void toggleFavorite(item)}
          onTags={updateSelectedTags}
        />
      )}
      <LinkImportDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onImported={refresh}
        initialUrl={initialLink}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tags={data.tags}
        onChanged={refresh}
      />
    </div>
  );
}

function VaultAccess({
  mode,
  onAuthenticated,
}: {
  mode: "setup" | "login";
  onAuthenticated: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setup = mode === "setup";

  const submit = async () => {
    if (setup && password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(setup ? "/api/auth/setup" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "无法登录");
      return;
    }
    onAuthenticated();
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#080a0c] px-5 text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-20rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-cyan-300/[0.06] blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 text-[#061014]">
            <Film size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-semibold tracking-[-0.02em]">X Video Vault</div>
            <div className="text-xs text-zinc-600">Private video library</div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/[0.09] bg-[#101419] p-6 shadow-2xl sm:p-7">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
            {setup ? <KeyRound size={20} /> : <LockKeyhole size={20} />}
          </div>
          <h1 className="text-xl font-semibold">
            {setup ? "创建 Vault 密码" : "打开你的视频库"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {setup
              ? "密码只用于保护这个网站，不需要填写任何 X API 密钥。"
              : "输入你首次设置的 Vault 密码。"}
          </p>
          <div className="mt-6 space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void submit()}
              placeholder={setup ? "至少 10 个字符" : "Vault 密码"}
              autoComplete={setup ? "new-password" : "current-password"}
              className="h-11 border-white/[0.1] bg-white/[0.04]"
            />
            {setup && (
              <Input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void submit()}
                placeholder="再次输入密码"
                autoComplete="new-password"
                className="h-11 border-white/[0.1] bg-white/[0.04]"
              />
            )}
          </div>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          <Button
            onClick={() => void submit()}
            disabled={busy || password.length < (setup ? 10 : 1)}
            className="mt-5 h-11 w-full rounded-xl bg-cyan-300 font-semibold text-[#061014] hover:bg-cyan-200"
          >
            {busy && <LoaderCircle className="animate-spin" />}
            {setup ? "创建并进入" : "进入 Vault"}
          </Button>
        </div>
      </div>
    </main>
  );
}

function Header({
  query,
  setQuery,
  onAdd,
  onSettings,
}: {
  query: string;
  setQuery: (value: string) => void;
  onAdd: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#080a0c]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-3 sm:h-[72px] sm:px-7">
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </Button>
        <div className="flex min-w-fit items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300 text-[#071014]">
            <Film size={18} strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block">
            <div className="text-[15px] font-semibold text-white">
              X Video Vault
            </div>
            <div className="text-xs text-zinc-600">Private collection</div>
          </div>
        </div>
        <div className="relative ml-auto hidden max-w-xl flex-1 sm:flex">
          <Search
            className="pointer-events-none absolute left-3.5 top-2.5 text-zinc-600"
            size={17}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文字、作者或标签…"
            className="h-10 rounded-xl border-white/[0.09] bg-white/[0.04] pl-10"
          />
        </div>
        <Button
          onClick={onAdd}
          className="h-10 rounded-xl bg-cyan-300 px-3.5 font-semibold text-[#071014] hover:bg-cyan-200"
        >
          <Plus size={17} />
          <span className="hidden md:inline">添加链接</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettings}
          className="text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          aria-label="Settings"
        >
          <Settings2 size={19} />
        </Button>
      </div>
      <div className="px-3 pb-3 sm:hidden">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-2.5 text-zinc-600"
            size={17}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索你的视频库…"
            className="h-9 rounded-xl border-white/[0.09] bg-white/[0.04] pl-10"
          />
        </div>
      </div>
    </header>
  );
}

function Sidebar({
  data,
  view,
  activeTag,
  onView,
  onTag,
  onSettings,
}: {
  data: LibraryResponse;
  view: string;
  activeTag: string | null;
  onView: (view: "all" | "favorites" | "tags") => void;
  onTag: (tag: string) => void;
  onSettings: () => void;
}) {
  return (
    <aside className="sticky top-[73px] hidden h-[calc(100vh-73px)] w-[228px] shrink-0 flex-col border-r border-white/[0.07] px-4 py-7 lg:flex">
      <nav className="space-y-1">
        <NavButton
          active={view === "all" && !activeTag}
          icon={<Library size={17} />}
          label="All videos"
          count={data.total}
          onClick={() => onView("all")}
        />
        <NavButton
          active={view === "favorites"}
          icon={<FolderHeart size={17} />}
          label="Favorites"
          onClick={() => onView("favorites")}
        />
        <NavButton
          active={view === "tags"}
          icon={<Tags size={17} />}
          label="Tags"
          onClick={() => onView("tags")}
        />
      </nav>
      <Separator className="my-7 bg-white/[0.07]" />
      <div className="mb-3 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
        <span>Collections</span>
        <button
          onClick={onSettings}
          className="text-zinc-500 hover:text-cyan-300"
          aria-label="Manage tags"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-0.5">
        {data.tags.slice(0, 10).map((tag) => (
          <button
            key={tag.id}
            onClick={() => onTag(tag.name)}
            className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm ${activeTag === tag.name ? "bg-cyan-300/10 text-cyan-200" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"}`}
          >
            <Tag size={14} className="mr-2" />
            <span className="truncate">{tag.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-auto rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-200">
          <Smartphone size={15} />
          手机同步可见
        </div>
        <p className="text-xs leading-5 text-zinc-500">
          电脑扩展采集到服务器数据库，手机登录同一网站即可浏览。
        </p>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-white/[0.07] text-white" : "text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200"}`}
    >
      <span className="mr-3">{icon}</span>
      <span>{label}</span>
      {typeof count === "number" && (
        <span className="ml-auto text-xs text-zinc-600">{count}</span>
      )}
    </button>
  );
}

function VideoCard({
  item,
  onOpen,
  onFavorite,
}: {
  item: VaultItem;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  return (
    <article className="group min-w-0">
      <button
        onClick={onOpen}
        className="relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101419] text-left"
      >
        {item.media.previewImageUrl ? (
          <Image
            src={item.media.previewImageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            unoptimized
            className="object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-700">
            <Film size={34} />
            <span className="text-xs">在播放器中从 X 加载</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/80 backdrop-blur">
          {item.media.type === "animated_gif" ? "GIF" : "Video"}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl">
            <Play size={19} fill="currentColor" />
          </span>
        </div>
        <div className="absolute inset-x-3 bottom-3">
          <p className="line-clamp-2 text-sm leading-5 text-white/90">
            {item.text || "X video Post"}
          </p>
        </div>
      </button>
      <div className="mt-3 flex items-start gap-2.5 px-0.5">
        <Avatar
          src={item.author?.profileImageUrl}
          label={item.author?.username ?? "X"}
        />
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-medium text-zinc-200">
            @{item.author?.username ?? "unknown"}
          </div>
          <div className="mt-0.5 text-xs text-zinc-600">
            {formatDate(item.createdAt)}
          </div>
        </button>
        <button
          onClick={onFavorite}
          className={`mt-0.5 p-1 ${item.isFavorite ? "text-rose-400" : "text-zinc-600 hover:text-white"}`}
          aria-label="Favorite"
        >
          <Heart size={17} fill={item.isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}

function Avatar({ src, label }: { src?: string | null; label: string }) {
  return src ? (
    <Image
      src={src}
      alt=""
      width={36}
      height={36}
      unoptimized
      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
    />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-xs font-semibold text-cyan-200">
      {label.slice(0, 1).toUpperCase()}
    </div>
  );
}

function CardSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="aspect-[4/5] rounded-2xl bg-white/[0.04]" />
          <div className="mt-3 h-8 rounded-lg bg-white/[0.035]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  query,
  onAdd,
  onSettings,
}: {
  query: string;
  onAdd: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="flex min-h-[52vh] flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.1] px-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.045] text-zinc-500">
        {query ? <Search size={23} /> : <MonitorDown size={23} />}
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">
        {query ? "没有搜索结果" : "开始建立你的视频库"}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
        {query
          ? "换一个关键词、作者或标签试试。"
          : "在电脑 X Likes 页面用浏览器扩展采集，或直接粘贴一个 X 帖子链接。"}
      </p>
      {!query && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            onClick={onAdd}
            className="rounded-xl bg-cyan-300 text-[#071014] hover:bg-cyan-200"
          >
            <Link2 size={16} />
            粘贴链接
          </Button>
          <Button
            onClick={onSettings}
            variant="outline"
            className="rounded-xl border-white/[0.1] bg-transparent text-zinc-300 hover:bg-white/[0.05]"
          >
            <MonitorDown size={16} />
            配置扩展
          </Button>
        </div>
      )}
    </div>
  );
}

function LinkImportDialog({
  open,
  onOpenChange,
  onImported,
  initialUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
  initialUrl: string;
}) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && initialUrl) setUrl(initialUrl);
  }, [initialUrl, open]);

  const submit = async () => {
    setBusy(true);
    setError("");
    const response = await fetch("/api/import/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, text: note, source: "link" }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "导入失败");
      return;
    }
    setUrl("");
    setNote("");
    onOpenChange(false);
    await onImported();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/[0.1] bg-[#101419] text-white">
        <DialogTitle className="flex items-center gap-2">
          <Link2 size={18} className="text-cyan-300" />
          添加 X 视频链接
        </DialogTitle>
        <p className="text-sm leading-6 text-zinc-500">
          粘贴形如 x.com/username/status/123 的链接。视频会通过 X
          官方嵌入播放器加载。
        </p>
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://x.com/.../status/..."
          className="h-11 border-white/[0.1] bg-white/[0.04]"
        />
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="可选备注（便于搜索）"
          className="h-11 border-white/[0.1] bg-white/[0.04]"
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <Button
          onClick={() => void submit()}
          disabled={busy || !url.trim()}
          className="h-11 rounded-xl bg-cyan-300 font-semibold text-[#071014] hover:bg-cyan-200"
        >
          {busy && <LoaderCircle className="animate-spin" />}
          添加到 Vault
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function DesktopViewer({
  selected,
  allTags,
  onClose,
  onStep,
  onFavorite,
  onTags,
}: {
  selected: VaultItem | null;
  allTags: TagSummary[];
  onClose: () => void;
  onStep: (direction: number) => void;
  onFavorite: (item: VaultItem) => void;
  onTags: (tagIds: number[]) => Promise<void>;
}) {
  const selectedTagIds = useMemo(
    () => new Set(selected?.tags.map((tag) => tag.id) ?? []),
    [selected],
  );

  return (
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl overflow-hidden border-white/[0.1] bg-[#0c0f12] p-0 text-white">
        <DialogTitle className="sr-only">Video viewer</DialogTitle>
        {selected && (
          <div className="grid min-h-[min(760px,88vh)] grid-cols-[minmax(0,1.4fr)_360px]">
            <div className="relative flex min-w-0 items-center justify-center overflow-y-auto bg-black p-6">
              <XPostEmbed url={selected.originalUrl} />
              <button
                onClick={() => onStep(-1)}
                className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
                aria-label="Previous"
              >
                <ChevronLeft size={21} />
              </button>
              <button
                onClick={() => onStep(1)}
                className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
                aria-label="Next"
              >
                <ChevronRight size={21} />
              </button>
            </div>
            <div className="flex flex-col overflow-y-auto p-7">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    src={selected.author?.profileImageUrl}
                    label={selected.author?.username ?? "X"}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {selected.author?.displayName ?? "X Post"}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      @{selected.author?.username ?? "unknown"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onFavorite(selected)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${selected.isFavorite ? "border-rose-300/30 bg-rose-300/10 text-rose-300" : "border-white/[0.1] text-zinc-500"}`}
                  aria-label="Favorite"
                >
                  <Heart
                    size={17}
                    fill={selected.isFavorite ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <p className="mt-6 whitespace-pre-wrap text-[15px] leading-7 text-zinc-300">
                {selected.text || "No captured Post text."}
              </p>
              <div className="mt-4 text-xs text-zinc-600">
                {formatDate(selected.createdAt)}
              </div>
              <Separator className="my-6 bg-white/[0.07]" />
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                Local tags
              </div>
              <div className="flex flex-wrap gap-2">
                {allTags.length ? (
                  allTags.map((tag) => {
                    const active = selectedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => {
                          const next = new Set(selectedTagIds);
                          if (active) next.delete(tag.id);
                          else next.add(tag.id);
                          void onTags([...next]);
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs ${active ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-white/[0.09] text-zinc-500 hover:text-white"}`}
                      >
                        {active && <Check className="mr-1 inline" size={12} />}
                        {tag.name}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-600">
                    在设置中创建标签后即可分组。
                  </p>
                )}
              </div>
              <div className="mt-auto pt-7">
                <a
                  href={selected.originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black"
                >
                  <ExternalLink size={16} />
                  Open on X
                </a>
                <p className="mt-3 text-center text-[11px] text-zinc-700">
                  ← → 切换 · Esc 关闭
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ExtensionToken = {
  id: number;
  name: string;
  tokenHint: string;
  createdAt: string;
  lastUsedAt?: string | null;
  revoked: boolean;
};

function SettingsDialog({
  open,
  onOpenChange,
  tags,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: TagSummary[];
  onChanged: () => Promise<void>;
}) {
  const [tokens, setTokens] = useState<ExtensionToken[]>([]);
  const [newToken, setNewToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const loadTokens = useCallback(async () => {
    const response = await fetch("/api/settings/extension-token");
    const result = (await response.json().catch(() => ({}))) as {
      tokens?: ExtensionToken[];
    };
    setTokens(result.tokens ?? []);
  }, []);

  useEffect(() => {
    if (open) void loadTokens();
  }, [loadTokens, open]);

  const createToken = async () => {
    const response = await fetch("/api/settings/extension-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Chrome / Edge" }),
    });
    const result = (await response.json()) as { token?: string };
    if (result.token) setNewToken(result.token);
    await loadTokens();
  };

  const revokeToken = async (id: number) => {
    await fetch("/api/settings/extension-token", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadTokens();
  };

  const createTag = async () => {
    if (!tagDraft.trim()) return;
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tagDraft }),
    });
    setTagDraft("");
    await onChanged();
  };

  const renameTag = async (id: number) => {
    if (!editName.trim()) return;
    await fetch("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName }),
    });
    setEditing(null);
    await onChanged();
  };

  const deleteTag = async (id: number) => {
    await fetch("/api/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto border-white/[0.1] bg-[#101419] text-white">
        <DialogTitle className="flex items-center gap-2">
          <Settings2 size={18} className="text-cyan-300" />
          Vault settings
        </DialogTitle>
        <section className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">浏览器扩展</h3>
              <p className="mt-1 text-xs text-zinc-600">
                扩展令牌只显示一次，可随时撤销。
              </p>
            </div>
            <Button
              onClick={() => void createToken()}
              size="sm"
              className="rounded-lg bg-cyan-300 text-[#071014] hover:bg-cyan-200"
            >
              <KeyRound size={14} />
              生成令牌
            </Button>
          </div>
          {newToken && (
            <div className="mb-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-3">
              <div className="mb-2 text-xs text-cyan-100">
                现在复制到扩展中，关闭后无法再次查看。
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-2 text-xs text-zinc-300">
                  {newToken}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="border-white/[0.1] bg-transparent"
                  onClick={async () => {
                    await navigator.clipboard.writeText(newToken);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {tokens
              .filter((token) => !token.revoked)
              .map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm text-zinc-300">{token.name}</div>
                    <div className="text-xs text-zinc-600">
                      …{token.tokenHint}
                      {token.lastUsedAt
                        ? ` · 最近使用 ${formatImport(token.lastUsedAt)}`
                        : " · 尚未使用"}
                    </div>
                  </div>
                  <button
                    onClick={() => void revokeToken(token.id)}
                    className="text-xs text-zinc-600 hover:text-rose-300"
                  >
                    撤销
                  </button>
                </div>
              ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SetupStep number="1" text="从 GitHub 下载 extension 文件夹" />
            <SetupStep number="2" text="Chrome 加载已解压的扩展程序" />
            <SetupStep number="3" text="填入网站地址和上方令牌" />
          </div>
        </section>

        <Separator className="my-6 bg-white/[0.07]" />

        <section>
          <h3 className="text-sm font-semibold">本地标签</h3>
          <div className="mt-3 flex gap-2">
            <Input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void createTag()}
              placeholder="新标签，例如 AI、Funny"
              className="border-white/[0.1] bg-white/[0.04]"
            />
            <Button
              onClick={() => void createTag()}
              size="icon"
              className="shrink-0 bg-cyan-300 text-[#071014] hover:bg-cyan-200"
            >
              <Plus size={17} />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-lg bg-white/[0.025] px-3 py-2"
              >
                {editing === tag.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="h-8 border-white/[0.1] bg-black/20"
                    />
                    <button
                      onClick={() => void renameTag(tag.id)}
                      className="text-cyan-300"
                      aria-label="Save tag"
                    >
                      <Check size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-zinc-400">
                      {tag.name}
                    </span>
                    <button
                      onClick={() => {
                        setEditing(tag.id);
                        setEditName(tag.name);
                      }}
                      className="text-zinc-600 hover:text-white"
                      aria-label="Rename tag"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => void deleteTag(tag.id)}
                      className="text-zinc-600 hover:text-rose-300"
                      aria-label="Delete tag"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <Separator className="my-6 bg-white/[0.07]" />

        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.reload();
          }}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white"
        >
          <LogOut size={15} />
          退出 Vault
        </button>
      </DialogContent>
    </Dialog>
  );
}

function SetupStep({ number, text }: { number: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
      <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.07] text-xs text-cyan-200">
        {number}
      </div>
      <p className="text-xs leading-5 text-zinc-500">{text}</p>
    </div>
  );
}

function MobileNavigation({
  view,
  activeTag,
  onView,
}: {
  view: string;
  activeTag: string | null;
  onView: (view: "all" | "favorites" | "tags") => void;
}) {
  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/[0.1] bg-[#12161a]/92 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
      <MobileNav
        active={view === "all" && !activeTag}
        icon={<Library size={17} />}
        label="Library"
        onClick={() => onView("all")}
      />
      <MobileNav
        active={view === "favorites"}
        icon={<Heart size={17} />}
        label="Saved"
        onClick={() => onView("favorites")}
      />
      <MobileNav
        active={view === "tags"}
        icon={<Tags size={17} />}
        label="Tags"
        onClick={() => onView("tags")}
      />
    </div>
  );
}

function MobileNav({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-[68px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] ${active ? "bg-white/[0.08] text-cyan-200" : "text-zinc-600"}`}
    >
      {icon}
      {label}
    </button>
  );
}
