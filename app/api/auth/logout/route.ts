import { json } from "@/lib/server";
import { logoutVault } from "@/lib/vault-auth";

export async function POST() {
  await logoutVault();
  return json({ ok: true });
}
