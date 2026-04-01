import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { getAppSecret } from "@/lib/env";

export const SESSION_COOKIE_NAME = "autotrip_session";

type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

function sign(data: string) {
  return createHmac("sha256", getAppSecret()).update(data).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds
  };

  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function getSessionFromCookies() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
