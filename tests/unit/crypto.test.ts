import { decryptString, encryptString } from "@/lib/security/crypto";

describe("crypto helpers", () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("encrypts and decrypts strings", () => {
    const encrypted = encryptString("secret-model-key");
    expect(encrypted).not.toBe("secret-model-key");
    expect(decryptString(encrypted)).toBe("secret-model-key");
  });
});
