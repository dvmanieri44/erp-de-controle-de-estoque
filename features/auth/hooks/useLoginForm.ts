"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useState } from "react";

import { authenticateUser } from "@/features/auth/services/auth.service";
import type { LoginInput } from "@/features/auth/types/auth";
import { validateLoginInput } from "@/features/auth/validators/login.validator";

const INITIAL_FORM_DATA: LoginInput = {
  email: "",
  password: "",
};

export function useLoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginInput>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Partial<LoginInput>>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
    setSubmitError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateLoginInput(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await authenticateUser(formData);
      router.push("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao autenticar usuário.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    errors,
    formData,
    handleChange,
    handleSubmit,
    isSubmitting,
    submitError,
  };
}
