import type { AuthUser, LoginInput } from "@/features/auth/types/auth";

const MOCK_USER = {
  email: "admin@estoque.com",
  name: "Administrador",
  password: "123456",
  role: "admin",
} as const;

export async function authenticateUser(input: LoginInput): Promise<AuthUser> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const isValidCredentials =
    input.email === MOCK_USER.email && input.password === MOCK_USER.password;

  if (!isValidCredentials) {
    throw new Error("Credenciais inválidas.");
  }

  return {
    email: MOCK_USER.email,
    name: MOCK_USER.name,
    role: MOCK_USER.role,
  };
}
