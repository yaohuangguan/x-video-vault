const captured = new Set();
let autoObserver = null;
let autoTimer = null;

function textOf(element) {
  return element?.textContent?.trim() || "";
}

function collectArticle(article) {
  const video =
    article.querySelector("video") ||
    article.querySelector('[data-testid="videoPlayer"] video');
  const hasVideoPlayer = Boolean(
    video || article.querySelector('[data-testid="videoPlayer"]'),
  );
  if (!hasVideoPlayer) return null;

  const time = article.querySelector("time");
  const timeLink = time?.closest("a");
  const fallbackLink = [...article.querySelectorAll('a[href*="/status/"]')].find(
    (anchor) => /\/status\/\d+/.test(anchor.getAttribute("href") || ""),
  );
  const href = timeLink?.href || fallbackLink?.href;
  const match = href?.match(
    /https?:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/([^/?#]+)\/status\/(\d+)/i,
  );
  if (!match) return null;

  const username = match[1] === "i" ? "" : match[1];
  const nameBlock = article.querySelector('[data-testid="User-Name"]');
  const nameParts = [...(nameBlock?.querySelectorAll("span") || [])]
    .map(textOf)
    .filter(Boolean);
  const displayName =
    nameParts.find((value) => !value.startsWith("@") && value !== "·") ||
    username;
  const avatar = article.querySelector(
    '[data-testid="Tweet-User-Avatar"] img',
  );
  const isGif =
    video?.loop ||
    Boolean(article.querySelector('[aria-label*="GIF" i]')) ||
    /\bGIF\b/.test(textOf(article.querySelector('[data-testid="videoPlayer"]')));

  return {
    url: `https://x.com/${username || "i"}/status/${match[2]}`,
    postId: match[2],
    text: textOf(article.querySelector('[data-testid="tweetText"]')),
    username,
    displayName,
    profileImageUrl: avatar?.src || null,
    previewImageUrl: video?.poster || null,
    createdAt: time?.getAttribute("datetime") || null,
    mediaType: isGif ? "animated_gif" : "video",
  };
}

function collectVisible() {
  const found = [];
  for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
    const post = collectArticle(article);
    if (!post || captured.has(post.postId)) continue;
    found.push(post);
  }
  return found;
}

function toast(message, error = false) {
  document.getElementById("xvv-collector-toast")?.remove();
  const element = document.createElement("div");
  element.id = "xvv-collector-toast";
  element.textContent = message;
  Object.assign(element.style, {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: "2147483647",
    padding: "12px 16px",
    borderRadius: "12px",
    color: error ? "#fecdd3" : "#cffafe",
    background: error ? "#3f151c" : "#102a30",
    border: error
      ? "1px solid rgba(251,113,133,.3)"
      : "1px solid rgba(103,232,249,.25)",
    font: "13px/1.4 system-ui, sans-serif",
    boxShadow: "0 12px 36px rgba(0,0,0,.35)",
  });
  document.documentElement.appendChild(element);
  window.setTimeout(() => element.remove(), 2800);
}

async function sendNewPosts() {
  const posts = collectVisible();
  if (!posts.length) return { received: 0, newlyAdded: 0, updated: 0 };
  const response = await chrome.runtime.sendMessage({
    type: "import-posts",
    posts,
  });
  if (!response?.ok) throw new Error(response?.error || "导入失败");
  for (const post of posts) captured.add(post.postId);
  return response.result;
}

function startAutoCapture() {
  if (autoObserver) return;
  autoObserver = new MutationObserver(() => {
    window.clearTimeout(autoTimer);
    autoTimer = window.setTimeout(() => {
      void sendNewPosts()
        .then((result) => {
          if (result.newlyAdded || result.updated) {
            toast(
              `Vault：新增 ${result.newlyAdded}，更新 ${result.updated}`,
            );
          }
        })
        .catch((error) => toast(error.message || "自动采集失败", true));
    }, 900);
  });
  autoObserver.observe(document.body, { childList: true, subtree: true });
  toast("自动采集已开启，继续向下滚动 Likes");
}

function stopAutoCapture() {
  autoObserver?.disconnect();
  autoObserver = null;
  window.clearTimeout(autoTimer);
  toast("自动采集已暂停");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "scan") {
    const posts = collectVisible();
    sendResponse({ ok: true, posts });
    return false;
  }
  if (message?.type === "toggle-auto") {
    if (message.enabled) startAutoCapture();
    else stopAutoCapture();
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "mark-captured") {
    for (const postId of message.postIds || []) captured.add(postId);
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
