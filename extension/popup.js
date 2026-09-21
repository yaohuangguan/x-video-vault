const vaultInput = document.getElementById("vault-url");
const tokenInput = document.getElementById("token");
const saveButton = document.getElementById("save");
const collectButton = document.getElementById("collect");
const autoInput = document.getElementById("auto");
const status = document.getElementById("status");

function show(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !loopback) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function activeXTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/(x|twitter)\.com\//.test(tab.url || "")) {
    throw new Error("请先打开 X 的 Likes 页面");
  }
  return tab;
}

async function saveSettings() {
  const vaultUrl = normalizeOrigin(vaultInput.value.trim());
  const token = tokenInput.value.trim();
  if (!vaultUrl || !token) throw new Error("请填写有效的网站地址和令牌");
  const permitted = await chrome.permissions.request({
    origins: [`${vaultUrl}/*`],
  });
  if (!permitted) throw new Error("需要允许扩展访问你的 Vault 网站");
  await chrome.storage.local.set({ vaultUrl, token });
  vaultInput.value = vaultUrl;
  show("连接信息已保存");
}

async function collect() {
  const tab = await activeXTab();
  show("正在读取当前页面…");
  const scan = await chrome.tabs.sendMessage(tab.id, { type: "scan" });
  if (!scan?.posts?.length) {
    show("当前已加载区域没有发现新视频");
    return;
  }
  const imported = await chrome.runtime.sendMessage({
    type: "import-posts",
    posts: scan.posts,
  });
  if (!imported?.ok) throw new Error(imported?.error || "导入失败");
  const result = imported.result;
  await chrome.tabs.sendMessage(tab.id, {
    type: "mark-captured",
    postIds: scan.posts.map((post) => post.postId),
  });
  const withMedia = scan.posts.filter((post) => Boolean(post.mediaUrl)).length;
  show(
    `完成：新增 ${result.newlyAdded}，更新 ${result.updated} · ${withMedia}/${scan.posts.length} 条带视频源`,
  );
}

saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  try {
    await saveSettings();
  } catch (error) {
    show(error.message || "保存失败", true);
  } finally {
    saveButton.disabled = false;
  }
});

collectButton.addEventListener("click", async () => {
  collectButton.disabled = true;
  try {
    await collect();
  } catch (error) {
    show(error.message || "采集失败", true);
  } finally {
    collectButton.disabled = false;
  }
});

autoInput.addEventListener("change", async () => {
  try {
    const tab = await activeXTab();
    await chrome.tabs.sendMessage(tab.id, {
      type: "toggle-auto",
      enabled: autoInput.checked,
    });
    show(autoInput.checked ? "自动采集已开启" : "自动采集已暂停");
  } catch (error) {
    autoInput.checked = false;
    show(error.message || "无法开启自动采集", true);
  }
});

chrome.storage.local.get(["vaultUrl", "token"]).then((saved) => {
  vaultInput.value = saved.vaultUrl || "";
  tokenInput.value = saved.token || "";
});
