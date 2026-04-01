import { prisma } from "@/lib/db/prisma";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function requireAdminUser() {
  const session = getSessionFromCookies();
  if (!session) {
    return null;
  }

  return prisma.adminUser.findUnique({
    where: { id: session.userId },
    include: { llmConfig: true }
  });
}
