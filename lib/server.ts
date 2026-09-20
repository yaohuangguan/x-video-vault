import { env } from "cloudflare:workers";
import { getDb } from "../db";

type RuntimeEnv = typeof env & { DB?: D1Database };

export function runtimeEnv() { return env as RuntimeEnv; }
export function dbOrNull() { try { return getDb(); } catch { return null; } }
export function json(data: unknown, init?: ResponseInit) { return Response.json(data, { headers: { "Cache-Control": "no-store" }, ...init }); }
