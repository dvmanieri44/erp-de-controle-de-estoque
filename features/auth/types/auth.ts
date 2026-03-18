export type LoginInput = {
  email: string;
  password: string;
};

export type AuthUser = {
  email: string;
  name: string;
  role: "admin";
};
