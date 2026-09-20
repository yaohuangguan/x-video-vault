import { importXPosts, type ImportedXPost } from "@/lib/import-posts";
import { dbOrNull, json } from "@/lib/server";
import { verifyExtensionRequest } from "@/lib/vault-auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  if (!dbOrNull()) {
    return json(
      { error: "Database unavailable" },
      { status: 503, headers: corsHeaders },
    );
  }
  if (!(await verifyExtensionRequest(request))) {
    return json(
      { error: "Invalid or revoked extension token" },
      { status: 401, headers: corsHeaders },
    );
  }
  const body = (await request.json().catch(() => ({}))) as {
    posts?: ImportedXPost[];
  };
  if (!Array.isArray(body.posts) || body.posts.length === 0) {
    return json(
      { error: "No video posts were supplied" },
      { status: 400, headers: corsHeaders },
    );
  }
  try {
    return json(await importXPosts(body.posts, "extension"), {
      headers: corsHeaders,
    });
  } catch {
    return json(
      { error: "The Vault could not import these posts" },
      { status: 500, headers: corsHeaders },
    );
  }
}
