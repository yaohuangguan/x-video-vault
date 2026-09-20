import { desc } from "drizzle-orm";
import { syncHistory } from "@/db/schema";
import { dbOrNull, json } from "@/lib/server";
import { isVaultAuthenticated } from "@/lib/vault-auth";

export async function GET() {
  const db = dbOrNull();
  if (!db) return json({ error: "Database unavailable" }, { status: 503 });
  if (!(await isVaultAuthenticated())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  return json({
    history: await db
      .select()
      .from(syncHistory)
      .orderBy(desc(syncHistory.startedAt))
      .limit(30)
      .all(),
  });
}
