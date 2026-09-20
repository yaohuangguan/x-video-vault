import { dbOrNull, json } from "@/lib/server";
import { loginWithPassword } from "@/lib/vault-auth";

export async function POST(request: Request) {
  if (!dbOrNull()) return json({ error: "Database unavailable" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!(await loginWithPassword(body.password ?? "", request))) {
    return json({ error: "Incorrect password" }, { status: 401 });
  }
  return json({ ok: true });
}
