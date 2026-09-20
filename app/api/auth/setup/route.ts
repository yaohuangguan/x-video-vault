import { dbOrNull, json } from "@/lib/server";
import { saveInitialPassword } from "@/lib/vault-auth";

export async function POST(request: Request) {
  if (!dbOrNull()) return json({ error: "Database unavailable" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  try {
    await saveInitialPassword(body.password ?? "", request);
    return json({ ok: true });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 400 },
    );
  }
}
