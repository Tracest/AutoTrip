import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getEncryptionKey } from "@/lib/env";

function deriveKey() {
  const raw = getEncryptionKey();
  const decoded = Buffer.from(raw, "base64");

  if (decoded.length === 32) {
    return decoded;
  }

  return createHash("sha256").update(raw).digest();
}

export function encryptString(plaintext: string) {
  const iv = randomBytes(12);
  const key = deriveKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptString(payload: string) {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted payload");
  }

  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}
