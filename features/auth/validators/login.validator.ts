import type { LoginInput } from "@/features/auth/types/auth";

export function validateLoginInput(
  input: LoginInput,
): Partial<Record<keyof LoginInput, string>> {
  const errors: Partial<Record<keyof LoginInput, string>> = {};

  if (!input.email.trim()) {
    errors.email = "Informe o e-mail.";
  } else if (!input.email.includes("@")) {
    errors.email = "Informe um e-mail valido.";
  }

  if (!input.password.trim()) {
    errors.password = "Informe a senha.";
  } else if (input.password.length < 6) {
    errors.password = "A senha deve ter ao menos 6 caracteres.";
  }

  return errors;
}
