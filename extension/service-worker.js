function normalizeVaultUrl(value) {
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !loopback) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function importPosts(posts) {
  const { vaultUrl, token } = await chrome.storage.local.get([
    "vaultUrl",
    "token",
  ]);
  const origin = normalizeVaultUrl(vaultUrl || "");
  if (!origin || !token) {
    throw new Error("请先保存 Vault 地址和扩展令牌");
  }
  const response = await fetch(`${origin}/api/import/extension`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ posts }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Vault returned ${response.status}`);
  }
  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "import-posts") return false;
  importPosts(Array.isArray(message.posts) ? message.posts : [])
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "导入失败",
      }),
    );
  return true;
});
