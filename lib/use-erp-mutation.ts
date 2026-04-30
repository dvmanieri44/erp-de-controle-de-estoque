"use client";

import { useState } from "react";

type ErpMutationState = {
  isLoading: boolean;
  error: string;
  success: string;
};

type ErpMutationOptions<TResult> = {
  fallbackErrorMessage: string;
  conflictMessage?: string;
  successMessage?: string;
  isVersionConflict?: (error: unknown) => boolean;
  reloadOnConflict?: () => Promise<void> | void;
  getErrorMessage?: (error: unknown, fallbackMessage: string) => string;
  onSuccess?: (result: TResult) => Promise<void> | void;
  onError?: (error: unknown, message: string) => Promise<void> | void;
};

const INITIAL_MUTATION_STATE: ErpMutationState = {
  isLoading: false,
  error: "",
  success: "",
};

export function useErpMutation() {
  const [state, setState] = useState<ErpMutationState>(INITIAL_MUTATION_STATE);

  async function runMutation<TResult>(
    operation: () => Promise<TResult>,
    options: ErpMutationOptions<TResult>,
  ) {
    setState({
      isLoading: true,
      error: "",
      success: "",
    });

    try {
      const result = await operation();
      await options.onSuccess?.(result);

      setState({
        isLoading: false,
        error: "",
        success: options.successMessage ?? "",
      });

      return result;
    } catch (error) {
      const isConflict = options.isVersionConflict?.(error) ?? false;

      if (isConflict) {
        await options.reloadOnConflict?.();
      }

      const message = isConflict
        ? options.conflictMessage ?? options.fallbackErrorMessage
        : options.getErrorMessage?.(error, options.fallbackErrorMessage) ??
          (error instanceof Error ? error.message : options.fallbackErrorMessage);

      setState({
        isLoading: false,
        error: message,
        success: "",
      });
      await options.onError?.(error, message);

      return null;
    }
  }

  function resetMutation() {
    setState(INITIAL_MUTATION_STATE);
  }

  return {
    ...state,
    runMutation,
    resetMutation,
  };
}
