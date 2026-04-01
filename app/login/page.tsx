import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  const session = getSessionFromCookies();
  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="grid w-full max-w-5xl gap-10 rounded-[32px] bg-white/85 p-6 shadow-soft backdrop-blur md:grid-cols-[1.2fr_0.9fr] md:p-10">
        <section className="rounded-[28px] bg-ink bg-hero-grid bg-[length:26px_26px] p-8 text-white">
          <p className="mb-3 text-sm uppercase tracking-[0.24em] text-white/70">AutoTrip V1</p>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight">
            接入你的大模型密钥和 URL，自动生成可编辑的出游路线。
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/72">
            第一版面向单用户自托管。首次登录会自动初始化管理员账号，之后所有模型配置和行程都归属于这一个账号。
          </p>
          <div className="mt-10 grid gap-4 text-sm text-white/84 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-medium">OpenAI 兼容模型</p>
              <p className="mt-1 leading-6">填写 `base URL / API key / model` 后由服务端统一代理调用。</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-medium">路线工作台</p>
              <p className="mt-1 leading-6">支持多日行程展示、拖拽调整、锁定关键景点后重排其余项目。</p>
            </div>
          </div>
        </section>
        <section className="rounded-[28px] border border-black/5 bg-mist p-8">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.22em] text-black/45">Sign In</p>
            <h2 className="mt-3 text-3xl font-semibold text-ink">进入你的出游规划工作台</h2>
          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
