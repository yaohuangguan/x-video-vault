(() => {
  if (window.__xvvMediaCaptureInstalled) return;
  window.__xvvMediaCaptureInstalled = true;

  const emitted = new Map();

  function bestMp4(variants) {
    if (!Array.isArray(variants)) return null;

    return (
      variants
        .filter(
          (variant) =>
            variant &&
            (variant.content_type === "video/mp4" ||
              variant.type === "video/mp4") &&
            typeof (variant.url || variant.src) === "string",
        )
        .map((variant) => ({
          url: variant.url || variant.src,
          bitrate: Number(variant.bitrate || 0),
        }))
        .filter((variant) => {
          try {
            const url = new URL(variant.url);
            return (
              url.protocol === "https:" &&
              url.hostname === "video.twimg.com"
            );
          } catch {
            return false;
          }
        })
        .sort((a, b) => b.bitrate - a.bitrate)[0] || null
    );
  }

  function posterFrom(node) {
    if (!node || typeof node !== "object") return null;

    return (
      node.media_url_https ||
      node.media_url ||
      node.poster ||
      node.image_url ||
      null
    );
  }

  function findVideoDeep(root, maxDepth = 10) {
    if (!root || typeof root !== "object") return null;

    const queue = [{ value: root, depth: 0 }];
    const seen = new Set();
    let visited = 0;

    while (queue.length && visited < 12000) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== "object" || seen.has(value)) continue;

      seen.add(value);
      visited += 1;

      const variants =
        value.video_info?.variants ||
        value.videoInfo?.variants ||
        value.variants;

      const source = bestMp4(variants);
      if (source) {
        return {
          ...source,
          previewImageUrl: posterFrom(value),
        };
      }

      if (depth >= maxDepth) continue;

      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === "object") {
            queue.push({ value: child, depth: depth + 1 });
          }
        }
      } else {
        for (const child of Object.values(value)) {
          if (child && typeof child === "object") {
            queue.push({ value: child, depth: depth + 1 });
          }
        }
      }
    }

    return null;
  }

  function emit(postId, mediaUrl, previewImageUrl) {
    if (!/^\d{1,40}$/.test(postId || "")) return;
    if (!mediaUrl || emitted.get(postId) === mediaUrl) return;

    emitted.set(postId, mediaUrl);
    window.postMessage(
      {
        type: "xvv-media-source",
        postId,
        mediaUrl,
        previewImageUrl: previewImageUrl || null,
      },
      window.location.origin,
    );
  }

  function inspectTweetLike(node) {
    if (!node || typeof node !== "object") return;

    const legacy =
      node.legacy && typeof node.legacy === "object" ? node.legacy : node;

    const postId =
      (typeof node.rest_id === "string" && node.rest_id) ||
      (typeof legacy.id_str === "string" && legacy.id_str) ||
      null;

    if (!postId) return;

    // Search the whole tweet subtree, not only direct extended_entities.
    // This covers quoted tweets, visibility wrappers and card/unified-card media.
    const found = findVideoDeep(node);
    if (!found) return;

    emit(
      postId,
      found.url,
      found.previewImageUrl ||
        legacy.extended_entities?.media?.[0]?.media_url_https ||
        null,
    );
  }

  function scanJson(root) {
    if (!root || typeof root !== "object") return;

    const stack = [root];
    const seen = new Set();
    let visited = 0;

    while (stack.length && visited < 50000) {
      const node = stack.pop();
      if (!node || typeof node !== "object" || seen.has(node)) continue;

      seen.add(node);
      visited += 1;
      inspectTweetLike(node);

      if (Array.isArray(node)) {
        for (const value of node) {
          if (value && typeof value === "object") stack.push(value);
        }
        continue;
      }

      for (const value of Object.values(node)) {
        if (value && typeof value === "object") stack.push(value);
      }
    }
  }

  function inspectResponse(response) {
    const contentType = response.headers?.get?.("content-type") || "";
    if (!contentType.includes("json")) return;

    response
      .clone()
      .json()
      .then(scanJson)
      .catch(() => {});
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      inspectResponse(response);
    } catch {
      // Never interfere with X's own fetch flow.
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    this.addEventListener("load", () => {
      try {
        const contentType = this.getResponseHeader("content-type") || "";
        if (!contentType.includes("json")) return;

        if (this.responseType === "json") {
          scanJson(this.response);
          return;
        }

        if (this.responseType === "" || this.responseType === "text") {
          scanJson(JSON.parse(this.responseText));
        }
      } catch {
        // Ignore non-JSON or inaccessible responses.
      }
    });

    return originalOpen.apply(this, args);
  };
})();
