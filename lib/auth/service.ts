import { prisma } from "@/lib/db/prisma";
import { createSessionToken } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export async function loginOrBootstrap(email: string, password: string) {
  const existingUsers = await prisma.adminUser.count();
  let user = await prisma.adminUser.findUnique({ where: { email } });

  if (existingUsers === 0 && !user) {
    user = await prisma.adminUser.create({
      data: {
        email,
        passwordHash: await hashPassword(password)
      }
    });
  }

  if (!user) {
    return null;
  }

  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) {
    return null;
  }

  return {
    user,
    token: createSessionToken({
      userId: user.id,
      email: user.email
    })
  };
}

export async function getAuthedUser() {
  const { getSessionFromCookies } = await import("@/lib/auth/session");
  const session = getSessionFromCookies();
  if (!session) {
    return null;
  }

  return prisma.adminUser.findUnique({
    where: { id: session.userId },
    include: { llmConfig: true }
  });
}
