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
  quoted_tweet?: {
    video?: SyndicationTweet["video"];
    mediaDetails?: SyndicationMedia[];
  };
};

const FEATURES = [
  "tfw_timeline_list:",
  "tfw_follower_count_sunset:true",
  "tfw_tweet_edit_backend:on",
  "tfw_refsrc_session:on",
  "tfw_fosnr_soft_interventions_enabled:on",
  "tfw_show_birdwatch_pivots_enabled:on",
  "tfw_show_business_verified_badge:on",
  "tfw_duplicate_scribes_to_settings:on",
  "tfw_use_profile_image_shape_enabled:on",
  "tfw_show_blue_verified_badge:on",
  "tfw_legacy_timeline_sunset:true",
  "tfw_show_gov_verified_badge:on",
  "tfw_show_business_affiliate_badge:on",
  "tfw_tweet_edit_frontend:on",
].join(";");

function getToken(id: string) {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

function safeHttps(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeVariants(variants: SyndicationVariant[] = []) {
  const mapped = variants
    .map((variant) => ({
      type: variant.content_type || variant.type || "",
      src: safeHttps(variant.url || variant.src),
      bitrate: variant.bitrate ?? 0,
    }))
    .filter(
      (variant): variant is { type: string; src: string; bitrate: number } =>
        Boolean(variant.src) &&
        (variant.type === "video/mp4" ||
          variant.type === "application/x-mpegURL"),
    );

  const hls = mapped.find((variant) => variant.type === "application/x-mpegURL");
  const mp4 = mapped
    .filter((variant) => variant.type === "video/mp4")
    .sort((a, b) => b.bitrate - a.bitrate)[0];

  return [hls, mp4].filter(
    (variant): variant is { type: string; src: string; bitrate: number } =>
      Boolean(variant),
  );
}

function extractFromTweet(tweet: SyndicationTweet | undefined) {
  if (!tweet) return null;

  if (tweet.video?.variants?.length) {
    const sources = normalizeVariants(tweet.video.variants);
    if (sources.length) {
      return {
        poster: safeHttps(tweet.video.poster),
        aspectRatio: tweet.video.aspectRatio ?? null,
        sources,
      };
    }
  }

  for (const media of tweet.mediaDetails ?? []) {
    if (media.type !== "video" && media.type !== "animated_gif") continue;
    const sources = normalizeVariants(media.video_info?.variants);
    if (sources.length) {
      return {
        poster: safeHttps(media.media_url_https),
        aspectRatio: media.video_info?.aspect_ratio ?? null,
        sources,
      };
    }
  }

  if (tweet.quoted_tweet) {
    return extractFromTweet(tweet.quoted_tweet as SyndicationTweet);
  }

  return null;
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

  const url = new URL("https://cdn.syndication.twimg.com/tweet-result");
  url.searchParams.set("id", postId);
  url.searchParams.set("lang", "en");
  url.searchParams.set("features", FEATURES);
  url.searchParams.set("token", getToken(postId));

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; XVideoVault/1.0; +https://github.com/yaohuangguan/x-video-vault)",
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      return Response.json(
        { available: false, reason: "not_found" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!response.ok) {
      return Response.json(
        { available: false, reason: "upstream_error" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const tweet = (await response.json()) as SyndicationTweet;

    if (
      tweet.__typename === "TweetTombstone" ||
      !tweet ||
      Object.keys(tweet).length === 0
    ) {
      return Response.json(
        { available: false, reason: "not_found" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const media = extractFromTweet(tweet);
    if (!media) {
      return Response.json(
        { available: false, reason: "no_video" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      { available: true, ...media },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return Response.json(
      { available: false, reason: "network_error" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
