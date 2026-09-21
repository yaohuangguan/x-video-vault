import { isVaultAuthenticated } from "@/lib/vault-auth";

type SyndicationVariant = {
  bitrate?: number;
  content_type?: string;
  url?: string;
  type?: string;
  src?: string;
};

type SyndicationMedia = {
  type?: string;
  media_url_https?: string;
  video_info?: {
    aspect_ratio?: number[];
    variants?: SyndicationVariant[];
  };
};

type SyndicationTweet = {
  __typename?: string;
  video?: {
    poster?: string;
    aspectRatio?: number[];
    variants?: SyndicationVariant[];
  };
  mediaDetails?: SyndicationMedia[];
  quoted_tweet?: SyndicationTweet;
  parent?: SyndicationTweet;
};

type MediaSource = {
  type: "video/mp4";
  src: string;
  bitrate: number;
};

const SYNDICATION_URL = "https://cdn.syndication.twimg.com/tweet-result";

function safeHttpsUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function pickBestMp4(variants: SyndicationVariant[] = []): MediaSource | null {
  const candidates = variants
    .map((variant) => ({
      type: variant.content_type || variant.type || "",
      src: safeHttpsUrl(variant.url || variant.src),
      bitrate: Number(variant.bitrate || 0),
    }))
    .filter(
      (variant): variant is { type: string; src: string; bitrate: number } =>
        variant.type === "video/mp4" && Boolean(variant.src),
    )
    .sort((a, b) => b.bitrate - a.bitrate);

  const best = candidates[0];
  if (!best) return null;

  return {
    type: "video/mp4",
    src: best.src,
    bitrate: best.bitrate,
  };
}

function extractVideo(tweet: SyndicationTweet | null | undefined):
  | {
      poster: string | null;
      aspectRatio: number[] | null;
      source: MediaSource;
    }
  | null {
  if (!tweet) return null;

  const rootSource = pickBestMp4(tweet.video?.variants);
  if (rootSource) {
    return {
      poster: safeHttpsUrl(tweet.video?.poster),
      aspectRatio: tweet.video?.aspectRatio ?? null,
      source: rootSource,
    };
  }

  for (const item of tweet.mediaDetails ?? []) {
    if (item.type !== "video" && item.type !== "animated_gif") continue;

    const source = pickBestMp4(item.video_info?.variants);
    if (!source) continue;

    return {
      poster: safeHttpsUrl(item.media_url_https),
      aspectRatio: item.video_info?.aspect_ratio ?? null,
      source,
    };
  }

  return (
    extractVideo(tweet.quoted_tweet) ??
    extractVideo(tweet.parent)
  );
}

function syndicationRequestUrls(postId: string) {
  const tokenZero = new URL(SYNDICATION_URL);
  tokenZero.searchParams.set("id", postId);
  tokenZero.searchParams.set("token", "0");

  const tokenZeroWithLang = new URL(tokenZero);
  tokenZeroWithLang.searchParams.set("lang", "en");

  return [
    { name: "token_zero", url: tokenZero },
    { name: "token_zero_lang", url: tokenZeroWithLang },
  ];
}

async function fetchSyndication(postId: string) {
  const attempts: Array<{
    name: string;
    status: number;
    contentType: string | null;
  }> = [];

  for (const candidate of syndicationRequestUrls(postId)) {
    const response = await fetch(candidate.url.toString(), {
      headers: {
        Accept: "application/json",
        Referer: "https://platform.twitter.com/",
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    attempts.push({
      name: candidate.name,
      status: response.status,
      contentType: response.headers.get("content-type"),
    });

    if (!response.ok) continue;

    const text = await response.text();
    if (!text.trim()) continue;

    let data: SyndicationTweet;
    try {
      data = JSON.parse(text) as SyndicationTweet;
    } catch {
      continue;
    }

    return { data, attempts };
  }

  return { data: null, attempts };
}

export async function GET(request: Request) {
  if (!(await isVaultAuthenticated())) {
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const postId = new URL(request.url).searchParams.get("postId") ?? "";
  if (!/^\d{1,40}$/.test(postId)) {
    return Response.json(
      { error: "Invalid postId" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { data: tweet, attempts } = await fetchSyndication(postId);

    if (!tweet) {
      return Response.json(
        {
          available: false,
          reason: "syndication_unavailable",
          postId,
          attempts,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (tweet.__typename === "TweetTombstone") {
      return Response.json(
        {
          available: false,
          reason: "tombstone",
          postId,
          attempts,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (Object.keys(tweet).length === 0) {
      return Response.json(
        {
          available: false,
          reason: "empty_response",
          postId,
          attempts,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const media = extractVideo(tweet);
    if (!media) {
      return Response.json(
        {
          available: false,
          reason: "no_video",
          postId,
          typename: tweet.__typename ?? null,
          keys: Object.keys(tweet).slice(0, 30),
          attempts,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const proxyUrl =
      `/api/media/proxy?url=${encodeURIComponent(media.source.src)}`;

    return Response.json(
      {
        available: true,
        poster: media.poster,
        aspectRatio: media.aspectRatio,
        sources: [
          {
            type: media.source.type,
            src: proxyUrl,
            bitrate: media.source.bitrate,
          },
        ],
        source: "syndication",
        attempts,
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    return Response.json(
      {
        available: false,
        reason: "network_error",
        postId,
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
