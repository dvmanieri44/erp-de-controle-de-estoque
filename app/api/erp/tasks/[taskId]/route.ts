import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanDeleteErpResource,
  assertCanReadErpResource,
  assertCanUpdateErpResource,
} from "@/lib/server/erp-access-control";
import {
  getAuditErrorMetadata,
  writeErpMutationAuditLog,
} from "@/lib/server/erp-audit";
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
    assertCanUpdateErpResource(session, TASKS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireTaskBaseVersion(body.baseVersion, "atualizar");
    const before = await getTaskById(taskId);
    const task = await updateTask(taskId, body.task, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.task.updated",
      session,
      resource: TASKS_RESOURCE_ID,
      entityId: taskId,
      request: requestMetadata,
      before,
      after: task,
      version: task.version,
    });

    return NextResponse.json({ task });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.task.updated",
      outcome,
      session,
      resource: TASKS_RESOURCE_ID,
      entityId: taskId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
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
    assertCanDeleteErpResource(session, TASKS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireTaskBaseVersion(body.baseVersion, "excluir");
    const before = await getTaskById(taskId);
    const deletedTask = await deleteTask(taskId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.task.deleted",
      session,
      resource: TASKS_RESOURCE_ID,
      entityId: taskId,
      request: requestMetadata,
      before,
      version: deletedTask.version,
      metadata: {
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

    await writeErpMutationAuditLog({
      action: "erp.task.deleted",
      outcome,
      session,
      resource: TASKS_RESOURCE_ID,
      entityId: taskId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao da tarefa.",
      fallbackErrorMessage: "Falha ao excluir a tarefa.",
      handlers: [getTaskNotFoundResponse, getTaskConflictResponse],
    });
  }
}
