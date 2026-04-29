"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { clearLocalErpResourceCaches } from "@/lib/erp-remote-sync";
import { clearCachedUserAccounts, clearLegacyClientAuthState } from "@/lib/user-accounts";

type LoginScreenProps = {
  nextPath: string;
  resetToken?: string | null;
};

type ForgotPasswordResponse = {
  error?: string;
  message?: string;
  debugResetUrl?: string;
};

type ResetPasswordResponse = {
  error?: string;
  message?: string;
};

type ScreenMode = "login" | "forgot" | "reset";

export function LoginScreen({ nextPath, resetToken }: LoginScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ScreenMode>(resetToken ? "reset" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [loginError, setLoginError] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [resetError, setResetError] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [debugResetUrl, setDebugResetUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeResetToken, setActiveResetToken] = useState(resetToken ?? "");

  useEffect(() => {
    clearLegacyClientAuthState();
    clearCachedUserAccounts();
    clearLocalErpResourceCaches();
  }, []);

  useEffect(() => {
    if (resetToken) {
      setActiveResetToken(resetToken);
      setMode("reset");
    }
  }, [resetToken]);

  const title = useMemo(() => {
    if (mode === "forgot") return "Recuperar acesso";
    if (mode === "reset") return "Redefinir senha";
    return "Fluxy";
  }, [mode]);

  const subtitle = useMemo(() => {
    if (mode === "forgot") return "Solicite um link seguro para redefinir sua senha";
    if (mode === "reset") return "Defina uma nova senha para voltar ao sistema";
    return "Faca login para continuar";
  }, [mode]);

  function goToLoginMode() {
    setMode("login");
    setForgotError("");
    setResetError("");
    setForgotMessage("");
    setResetMessage("");
    setDebugResetUrl("");
    setResetPassword("");
    setResetPasswordConfirm("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");

    if (!username.trim() || !password.trim()) {
      setLoginError("Informe usuario e senha.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setLoginError(payload?.error ?? "Nao foi possivel concluir o login.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setLoginError("Nao foi possivel conectar ao backend de autenticacao.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setForgotError("");
    setForgotMessage("");
    setDebugResetUrl("");

    if (!forgotIdentifier.trim()) {
      setForgotError("Informe seu usuario ou e-mail.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: forgotIdentifier,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ForgotPasswordResponse | null;

      if (!response.ok) {
        setForgotError(payload?.error ?? "Nao foi possivel solicitar a redefinicao agora.");
        return;
      }

      setForgotMessage(payload?.message ?? "Se a conta existir, o processo de redefinicao foi iniciado.");
      setDebugResetUrl(payload?.debugResetUrl ?? "");
    } catch {
      setForgotError("Nao foi possivel solicitar a redefinicao agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!activeResetToken) {
      setResetError("Token de redefinicao ausente ou invalido.");
      return;
    }

    if (!resetPassword.trim() || !resetPasswordConfirm.trim()) {
      setResetError("Informe e confirme a nova senha.");
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setResetError("A confirmacao da senha nao confere.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: activeResetToken,
          password: resetPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ResetPasswordResponse | null;

      if (!response.ok) {
        setResetError(payload?.error ?? "Nao foi possivel redefinir a senha agora.");
        return;
      }

      setActiveResetToken("");
      setResetPassword("");
      setResetPasswordConfirm("");
      setResetMessage(payload?.message ?? "Senha redefinida com sucesso.");
      setMode("login");
    } catch {
      setResetError("Nao foi possivel redefinir a senha agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-200 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-[0_10px_35px_rgba(15,23,42,0.14)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl text-white">
          â†’
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>

        {resetMessage ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{resetMessage}</p> : null}

        {mode === "login" ? (
          <form className="mt-6 space-y-4 text-left" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Usuario ou e-mail</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Digite seu usuario ou e-mail"
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

            {loginError ? <p className="text-sm font-medium text-rose-600">{loginError}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setLoginError("");
              }}
              className="w-full text-sm font-medium text-blue-700 transition hover:opacity-80"
            >
              Esqueci minha senha
            </button>
          </form>
        ) : null}

        {mode === "forgot" ? (
          <form className="mt-6 space-y-4 text-left" onSubmit={handleForgotPassword}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Usuario ou e-mail</span>
              <input
                type="text"
                value={forgotIdentifier}
                onChange={(event) => setForgotIdentifier(event.target.value)}
                placeholder="Informe sua conta para recuperar o acesso"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600"
              />
            </label>

            {forgotError ? <p className="text-sm font-medium text-rose-600">{forgotError}</p> : null}
            {forgotMessage ? <p className="text-sm text-emerald-700">{forgotMessage}</p> : null}
            {debugResetUrl ? (
              <a href={debugResetUrl} className="block text-sm font-medium text-blue-700 underline">
                Abrir link de redefinicao gerado para desenvolvimento
              </a>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Solicitando..." : "Solicitar redefinicao"}
            </button>

            <button
              type="button"
              onClick={goToLoginMode}
              className="w-full text-sm font-medium text-slate-600 transition hover:opacity-80"
            >
              Voltar para o login
            </button>
          </form>
        ) : null}

        {mode === "reset" ? (
          <form className="mt-6 space-y-4 text-left" onSubmit={handleResetPassword}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nova senha</span>
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="Defina sua nova senha"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Confirmar nova senha</span>
              <input
                type="password"
                value={resetPasswordConfirm}
                onChange={(event) => setResetPasswordConfirm(event.target.value)}
                placeholder="Repita a nova senha"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600"
              />
            </label>

            {resetError ? <p className="text-sm font-medium text-rose-600">{resetError}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Redefinindo..." : "Salvar nova senha"}
            </button>

            <button
              type="button"
              onClick={goToLoginMode}
              className="w-full text-sm font-medium text-slate-600 transition hover:opacity-80"
            >
              Voltar para o login
            </button>
          </form>
        ) : null}

        {mode === "login" &&
        process.env.NODE_ENV !== "production" &&
        process.env.NEXT_PUBLIC_ENABLE_DEV_CREDENTIAL_HINTS === "true" ? (
          <div className="mt-5 rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-700">
            <strong>Acessos locais de desenvolvimento:</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>admin / admin123</li>
              <li>joao / 123456</li>
              <li>maria / 123456</li>
            </ul>
          </div>
        ) : null}

        {mode === "login" && process.env.NODE_ENV === "production" ? (
          <p className="mt-5 text-xs text-slate-500">
            Use a conta provisionada pela administracao do sistema.
          </p>
        ) : null}
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
