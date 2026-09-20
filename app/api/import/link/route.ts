import { importXPosts } from "@/lib/import-posts";
import { dbOrNull, json } from "@/lib/server";
import { isVaultAuthenticated } from "@/lib/vault-auth";

export async function POST(request: Request) {
  if (!dbOrNull()) return json({ error: "Database unavailable" }, { status: 503 });
  if (!(await isVaultAuthenticated())) {
    return json({ error: "Sign in to your Vault first" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    url?: string;
    text?: string;
    source?: "link" | "share";
  };
  if (!body.url?.trim()) {
    return json({ error: "Paste an X Post link" }, { status: 400 });
  }
  const result = await importXPosts(
    [{ url: body.url, text: body.text }],
    body.source === "share" ? "share" : "link",
  );
  if (result.skipped) {
    return json(
      { error: "That does not look like an X Post link" },
      { status: 400 },
    );
  }
  return json(result);
}
