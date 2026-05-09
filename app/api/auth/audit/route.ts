import { NextResponse } from "next/server";

import { listAuditLogs, type AuditLogCategory } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await readServerSession();

  if (!session) {
    return NextResponse.json({ error: "Sessao expirada. Entre novamente." }, { status: 401 });
  }

  if (session.role !== "administrador") {
    return NextResponse.json({ error: "Somente administradores podem consultar a auditoria." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const category = url.searchParams.get("category") as AuditLogCategory | null;
    const entries = await listAuditLogs({
      limit: Number.isFinite(limit) ? limit : 50,
      category: category ?? undefined,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar a auditoria.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
