"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("admin@autotrip.local");
  const [password, setPassword] = useState("autotrip123");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "登录失败，请检查邮箱和密码。");
      return;
    }

    startTransition(() => {
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-black/70">邮箱</span>
        <input
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-accent"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-black/70">密码</span>
        <input
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-accent"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
      </label>
      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
      <button
        className="w-full rounded-2xl bg-accent px-4 py-3 text-base font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
        type="submit"
        disabled={isPending}
      >
        {isPending ? "进入中..." : "登录 / 初始化管理员"}
      </button>
      <p className="text-sm leading-6 text-black/55">
        如果系统里还没有管理员账号，首次提交会自动创建当前邮箱作为唯一管理员。
      </p>
    </form>
  );
}
