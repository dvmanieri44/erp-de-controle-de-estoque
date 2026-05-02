import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import {
  getAuditErrorMetadata,
  writeErpMutationAuditLog,
} from "@/lib/server/erp-audit";
import { readServerSession } from "@/lib/server/auth-session";
import {
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import {
  createTask,
  getTasksPersistenceProvider,
  listTasks,
} from "@/lib/server/tasks";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const TASKS_RESOURCE_ID = "operations.tasks";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, TASKS_RESOURCE_ID);
    const payload = await listTasks();

    return NextResponse.json({
      ...payload,
      provider: getTasksPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar as tarefas.",
    });
  }
}

export async function POST(request: Request) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanWriteErpResource(session, TASKS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const task = await createTask(body.task);

    await writeErpMutationAuditLog({
      action: "erp.task.created",
      session,
      resource: TASKS_RESOURCE_ID,
      entityId: task.id,
      request: requestMetadata,
      after: task,
      version: task.version,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.task.created",
      outcome,
      session,
      resource: TASKS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao da tarefa.",
      fallbackErrorMessage: "Falha ao criar a tarefa.",
    });
  }
}
