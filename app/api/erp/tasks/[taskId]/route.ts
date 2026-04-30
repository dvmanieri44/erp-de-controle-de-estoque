import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import {
  createPayloadErrorHandler,
  createStatusMessageErrorHandler,
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import {
  deleteTask,
  getTaskById,
  getTaskVersionConflictPayload,
  requireTaskBaseVersion,
  TaskConflictError,
  TaskNotFoundError,
  updateTask,
} from "@/lib/server/tasks";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

const TASKS_RESOURCE_ID = "operations.tasks";

function getTaskTarget(taskId: string) {
  return {
    accountId: null,
    resource: `${TASKS_RESOURCE_ID}:${taskId}`,
  };
}

const getTaskNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is TaskNotFoundError => error instanceof TaskNotFoundError,
);
const getTaskConflictResponse = createPayloadErrorHandler(
  (error): error is TaskConflictError => error instanceof TaskConflictError,
  getTaskVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { taskId } = await context.params;
    assertCanReadErpResource(session, TASKS_RESOURCE_ID);
    const task = await getTaskById(taskId);
    return NextResponse.json({ task });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar a tarefa.",
      handlers: [getTaskNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { taskId } = await context.params;

  try {
    assertCanWriteErpResource(session, TASKS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireTaskBaseVersion(body.baseVersion, "atualizar");
    const task = await updateTask(taskId, body.task, {
      baseVersion,
    });

    await writeAuditLog({
      category: "erp",
      action: "erp.task.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getTaskTarget(taskId),
      request: requestMetadata,
      metadata: {
        version: task.version,
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.task.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getTaskTarget(taskId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao da tarefa.",
      fallbackErrorMessage: "Falha ao atualizar a tarefa.",
      handlers: [getTaskNotFoundResponse, getTaskConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { taskId } = await context.params;

  try {
    assertCanWriteErpResource(session, TASKS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireTaskBaseVersion(body.baseVersion, "excluir");
    const deletedTask = await deleteTask(taskId, baseVersion);

    await writeAuditLog({
      category: "erp",
      action: "erp.task.deleted",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getTaskTarget(taskId),
      request: requestMetadata,
      metadata: {
        version: deletedTask.version,
        deletedAt: deletedTask.deletedAt,
      },
    });

    return NextResponse.json({
      taskId: deletedTask.id,
      version: deletedTask.version,
      deletedAt: deletedTask.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.task.deleted",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getTaskTarget(taskId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao da tarefa.",
      fallbackErrorMessage: "Falha ao excluir a tarefa.",
      handlers: [getTaskNotFoundResponse, getTaskConflictResponse],
    });
  }
}
