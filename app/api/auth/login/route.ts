import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas/auth";
import { loginOrBootstrap } from "@/lib/auth/service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await request.json());
    const result = await loginOrBootstrap(payload.email, payload.password);

    if (!result) {
      return jsonError("Invalid credentials.", 401);
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: result.user.id,
        email: result.user.email
      }
    });

    response.cookies.set(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error) {
    return jsonError("Unable to sign in.", 400, error instanceof Error ? error.message : error);
  }
}
