"use client";

import { useLoginForm } from "@/features/auth/hooks/useLoginForm";

export default function LoginPage() {
  const {
    errors,
    formData,
    handleChange,
    handleSubmit,
    isSubmitting,
    submitError,
  } = useLoginForm();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f2f2] px-4 font-sans text-[#1f2937]">
      <section className="w-full max-w-[350px] rounded-[10px] bg-white p-10 shadow-[0_4px_15px_rgba(0,0,0,0.1)]">
        <h1 className="mb-[5px] text-2xl font-semibold text-[#1f2937]">
          Entrar no sistema
        </h1>
        <p className="mb-5 text-base text-gray-500">Preencha suas credenciais.</p>

        <form className="space-y-[15px]" onSubmit={handleSubmit}>
          <div>
            <input
              autoComplete="email"
              className="w-full rounded-md border-0 bg-[#eeeeee] px-3 py-3 text-base text-[#1f2937] outline-none transition focus:ring-2 focus:ring-[#2ee6a6]"
              name="email"
              onChange={handleChange}
              placeholder="Email"
              type="email"
              value={formData.email}
            />
            {errors.email ? (
              <p className="mt-2 text-sm text-red-500" role="alert">
                {errors.email}
              </p>
            ) : null}
          </div>

          <div>
            <input
              autoComplete="current-password"
              className="w-full rounded-md border-0 bg-[#eeeeee] px-3 py-3 text-base text-[#1f2937] outline-none transition focus:ring-2 focus:ring-[#2ee6a6]"
              name="password"
              onChange={handleChange}
              placeholder="Senha"
              type="password"
              value={formData.password}
            />
            {errors.password ? (
              <p className="mt-2 text-sm text-red-500" role="alert">
                {errors.password}
              </p>
            ) : null}
          </div>

          {submitError ? (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <button
            className="w-full rounded-md border-0 bg-[#2ee6a6] px-3 py-3 text-base font-medium text-white transition hover:bg-[#26c98f] focus:outline-none focus:ring-2 focus:ring-[#2ee6a6] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#9ee8cf]"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-[15px] text-[13px] text-gray-500">
          <a className="text-[#2ee6a6] no-underline hover:text-[#26c98f]" href="#">
            Esqueci minha senha
          </a>
          <p className="mt-3">
            Não tenho uma conta.{" "}
            <a className="text-[#2ee6a6] no-underline hover:text-[#26c98f]" href="#">
              Criar
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
