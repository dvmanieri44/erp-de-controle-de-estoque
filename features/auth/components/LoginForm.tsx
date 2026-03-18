"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLoginForm } from "@/features/auth/hooks/useLoginForm";

export function LoginForm() {
  const {
    errors,
    formData,
    handleChange,
    handleSubmit,
    isSubmitting,
    submitError,
  } = useLoginForm();

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <Input
        autoComplete="email"
        error={errors.email}
        id="email"
        label="E-mail"
        name="email"
        onChange={handleChange}
        placeholder="admin@estoque.com"
        type="email"
        value={formData.email}
      />

      <Input
        autoComplete="current-password"
        error={errors.password}
        id="password"
        label="Senha"
        name="password"
        onChange={handleChange}
        placeholder="Digite sua senha"
        type="password"
        value={formData.password}
      />

      {submitError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {submitError}
        </p>
      ) : null}

      <Button disabled={isSubmitting} isFullWidth type="submit">
        {isSubmitting ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
