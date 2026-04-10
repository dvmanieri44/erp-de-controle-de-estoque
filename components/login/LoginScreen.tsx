"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  authenticateTestUser,
  hasActiveUserSession,
  saveActiveLoginUsername,
  saveActiveUserAccountId,
} from "@/lib/user-accounts";

export function LoginScreen({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hasActiveUserSession()) {
      router.replace(nextPath);
    }
  }, [nextPath, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Informe usuario e senha.");
      return;
    }

    setIsSubmitting(true);

    const account = authenticateTestUser(username, password);

    if (!account) {
      setError("Credenciais invalidas. Use um dos acessos de teste.");
      setIsSubmitting(false);
      return;
    }

    saveActiveLoginUsername(username);
    saveActiveUserAccountId(account.id);
    router.replace(nextPath);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-200 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-[0_10px_35px_rgba(15,23,42,0.14)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl text-white">
          →
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Fluxy</h1>
        <p className="mt-2 text-sm text-slate-500">Faca login para continuar</p>

        <form className="mt-6 space-y-4 text-left" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Usuario</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Digite seu usuario"
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600"
            />
          </label>

          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-5 rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-700">
          <strong>Usuarios de teste:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>admin / admin123 acessa o perfil administrador</li>
            <li>joao / 123456 acessa o perfil operador</li>
            <li>maria / 123456 acessa o perfil gestor</li>
          </ul>
        </div>
      </div>

      <button
        type="button"
        aria-label="Ajuda"
        className="fixed bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-lg text-white shadow-[0_10px_24px_rgba(15,23,42,0.22)]"
      >
        ?
      </button>
    </div>
  );
}
