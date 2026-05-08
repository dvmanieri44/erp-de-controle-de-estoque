import "server-only";

import { NextResponse } from "next/server";

import { ErpAccessDeniedError } from "@/lib/server/erp-access-control";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";

type StatusError = Error & {
  status: number;
};

export type ErpApiErrorResponseHandler = (
  error: unknown,
) => NextResponse | null;

type ErpApiErrorResponseOptions = {
  fallbackErrorMessage: string;
  handlers?: ErpApiErrorResponseHandler[];
  syntaxErrorMessage?: string;
};

export async function readJsonObjectBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  return JSON.parse(rawBody) as Record<string, unknown>;
}

export function getUnauthorizedErpResponse() {
  return NextResponse.json(
    { error: "Sessao obrigatoria para acessar o ERP." },
    { status: 401 },
  );
}

export function createStatusMessageErrorHandler<TError extends StatusError>(
  isMatch: (error: unknown) => error is TError,
): ErpApiErrorResponseHandler {
  return (error) => {
    if (!isMatch(error)) {
      return null;
    }

    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  };
}

export function createPayloadErrorHandler<TError extends StatusError>(
  isMatch: (error: unknown) => error is TError,
  getPayload: (error: TError) => unknown,
): ErpApiErrorResponseHandler {
  return (error) => {
    if (!isMatch(error)) {
      return null;
    }

    return NextResponse.json(getPayload(error), { status: error.status });
  };
}

export function createInUseErrorHandler<
  TError extends StatusError & { reasons: string[] },
>(
  isMatch: (error: unknown) => error is TError,
  errorCode: string,
): ErpApiErrorResponseHandler {
  return createPayloadErrorHandler(isMatch, (error) => ({
    error: errorCode,
    reasons: error.reasons,
  }));
}

function getCommonErpErrorResponse(error: unknown) {
  if (
    error instanceof ErpAccessDeniedError ||
    error instanceof ErpResourceValidationError
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  return null;
}

function getInternalErpErrorResponse(error: unknown, fallbackErrorMessage: string) {
  return NextResponse.json(
    {
      error: fallbackErrorMessage,
      details: error instanceof Error ? error.message : "Erro desconhecido.",
    },
    { status: 500 },
  );
}

export function getErpApiErrorResponse(
  error: unknown,
  {
    fallbackErrorMessage,
    handlers = [],
    syntaxErrorMessage,
  }: ErpApiErrorResponseOptions,
) {
  if (syntaxErrorMessage && error instanceof SyntaxError) {
    return NextResponse.json(
      { error: syntaxErrorMessage },
      { status: 400 },
    );
  }

  for (const handler of handlers) {
    const response = handler(error);

    if (response) {
      return response;
    }
  }

  return (
    getCommonErpErrorResponse(error) ??
    getInternalErpErrorResponse(error, fallbackErrorMessage)
  );
}
