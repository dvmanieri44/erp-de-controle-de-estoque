import { Card } from "@/components/ui/Card";
import { LoginForm } from "@/features/auth/components/LoginForm";

export function LoginScreen() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between rounded-[2rem] bg-slate-900 p-8 text-white">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">
              ERP de Estoque
            </span>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight">
              Controle produtos, entradas e saídas com uma base organizada para
              crescer.
            </h1>
            <p className="max-w-lg text-base leading-7 text-slate-300">
              A tela de login já nasce desacoplada da regra de autenticação,
              pronta para receber API, sessão e perfis de acesso.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Produtos
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Movimentações
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Alertas
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <Card className="w-full max-w-md">
            <div className="mb-8 space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">Entrar</h2>
              <p className="text-sm leading-6 text-slate-500">
                Use `admin@estoque.com` e `123456` para acessar o fluxo inicial.
              </p>
            </div>
            <LoginForm />
          </Card>
        </section>
      </div>
    </main>
  );
}
