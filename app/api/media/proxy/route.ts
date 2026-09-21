import { isVaultAuthenticated } from "@/lib/vault-auth";

const ALLOWED_MEDIA_HOSTS = new Set(["video.twimg.com"]);

function allowedMediaUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_MEDIA_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function copyHeader(
  from: Headers,
  to: Headers,
  name: string,
) {
  const value = from.get(name);
  if (value) to.set(name, value);
}

async function proxy(request: Request, headOnly = false) {
  if (!(await isVaultAuthenticated())) {
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const mediaUrl = allowedMediaUrl(
    new URL(request.url).searchParams.get("url"),
  );

  if (!mediaUrl) {
    return Response.json(
      { error: "Invalid media URL" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const headers = new Headers({
    Accept: "*/*",
    Referer: "https://x.com/",
    "User-Agent": "Mozilla/5.0",
  });

  const range = request.headers.get("range");
  if (range) headers.set("Range", range);

  const ifRange = request.headers.get("if-range");
  if (ifRange) headers.set("If-Range", ifRange);

  const upstream = await fetch(mediaUrl.toString(), {
    method: headOnly ? "HEAD" : "GET",
    headers,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    copyHeader(upstream.headers, responseHeaders, name);
  }

  responseHeaders.set(
    "Cache-Control",
    upstream.ok
      ? "private, max-age=3600"
      : "no-store",
  );

  return new Response(headOnly ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) {
  return proxy(request);
}

export async function HEAD(request: Request) {
  return proxy(request, true);
}
