(() => {
  if (window.__xvvMediaCaptureInstalled) return;
  window.__xvvMediaCaptureInstalled = true;

  const emitted = new Map();

  function bestMp4(variants) {
    if (!Array.isArray(variants)) return null;

    return variants
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
          return url.protocol === "https:" && url.hostname === "video.twimg.com";
        } catch {
          return false;
        }
      })
      .sort((a, b) => b.bitrate - a.bitrate)[0] || null;
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

    const legacy = node.legacy && typeof node.legacy === "object"
      ? node.legacy
      : node;

    const postId =
      (typeof node.rest_id === "string" && node.rest_id) ||
      (typeof legacy.id_str === "string" && legacy.id_str) ||
      null;

    if (!postId) return;

    const mediaLists = [
      legacy.extended_entities?.media,
      legacy.entities?.media,
      node.extended_entities?.media,
      node.entities?.media,
    ];

    for (const list of mediaLists) {
      if (!Array.isArray(list)) continue;

      for (const item of list) {
        if (!item || (item.type !== "video" && item.type !== "animated_gif")) {
          continue;
        }

        const best = bestMp4(item.video_info?.variants);
        if (!best) continue;

        emit(
          postId,
          best.url,
          item.media_url_https || item.media_url || null,
        );
        return;
      }
    }
  }

  function scanJson(root) {
    if (!root || typeof root !== "object") return;

    const stack = [root];
    let visited = 0;

    while (stack.length && visited < 50000) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
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
