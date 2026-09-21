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
  const divisor = BigInt("1000000000000000");
  const value = BigInt(id);
  const high = Number(value / divisor);
  const low = Number(value % divisor) / 1e15;
  return ((high + low) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

function buildSyndicationUrls(postId: string) {
  const make = (
    token: string,
    includeFeatures = false,
  ) => {
    try {
    const attempts: Array<{ name: string; status: number }> = [];
    let tweet: SyndicationTweet | null = null;

    for (const candidate of buildSyndicationUrls(postId)) {
      const response = await fetch(candidate.url.toString(), {
        cache: "no-store",
      });

      attempts.push({ name: candidate.name, status: response.status });

      if (!response.ok) continue;

      const data = (await response.json().catch(() => null)) as
        | SyndicationTweet
        | null;

      if (!data) continue;

      tweet = data;
      break;
    }

    if (!tweet) {
      return Response.json(
        {
          available: false,
          reason: "upstream_error",
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
          typename: tweet.__typename,
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

    const media = extractFromTweet(tweet);
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

    return Response.json(
      {
        available: true,
        ...media,
        source: "syndication",
        attempts,
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return Response.json(
      { available: false, reason: "network_error", postId },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
