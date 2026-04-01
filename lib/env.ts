function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAppSecret() {
  return getEnv("APP_SECRET");
}

export function getEncryptionKey() {
  return getEnv("APP_ENCRYPTION_KEY");
}

export function getAmapApiKey() {
  return process.env.AMAP_API_KEY ?? "";
}
