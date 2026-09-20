import { dbOrNull, json } from "@/lib/server";
import {
  getVaultAuthState,
  isVaultAuthenticated,
} from "@/lib/vault-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbOrNull()) {
    return json(
      { error: "Database is unavailable. Run the local database setup first." },
      { status: 503 },
    );
  }
  const state = await getVaultAuthState();
  return json({
    state,
    authenticated: state === "login" && (await isVaultAuthenticated()),
  });
}
