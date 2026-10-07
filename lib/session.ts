import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 ore

export interface SessionPayload {
  idCustomer: string;
  name: string;
  exp: number; // epoch ms
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = { ...payload, exp: Date.now() + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "fidelity_session";
