"use client";

import {
  NOTIFICATION_STATUS_DONE,
  toneByLabel,
} from "@/components/dashboard/operations/module-helpers";
import {
  ActionButton,
  Hero,
  Panel,
  StatusPill,
  SummaryCard,
} from "@/components/dashboard/operations/ui";
import { useErpResourceCollection } from "@/components/dashboard/operations/useErpResourceCollection";
import type { DashboardSection } from "@/lib/dashboard-sections";
import {
  loadNotifications,
  refreshNotifications,
  updateNotification as updateNotificationRecord,
  NotificationItemRequestError,
  NotificationItemVersionConflictError,
  type VersionedNotificationItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const NOTIFICATIONS_CONFLICT_MESSAGE =
  "Conflito de versao: estas notificacoes foram alteradas por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita.";

function isNotificationMutationConflict(error: unknown) {
  return (
    error instanceof NotificationItemVersionConflictError ||
    (error instanceof NotificationItemRequestError && error.status === 409)
  );
}

function getNotificationMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof NotificationItemRequestError
    ? error.message
    : fallbackMessage;
}

export function NotificationsModule({
  section,
}: {
  section: DashboardSection;
}) {
  const { canUpdate } = useErpPermissions();
  const canUpdateNotifications = canUpdate("operations.notifications");
  const [notifications, setNotifications] = useErpResourceCollection(
    "operations.notifications",
    loadNotifications,
  );
  const notificationsMutation = useErpMutation();

  async function reloadNotificationsAfterConflict() {
    try {
      setNotifications(await refreshNotifications());
    } catch {
      setNotifications(loadNotifications());
    }
  }

  async function resolveUnreadNotifications() {
    const unreadNotifications = notifications.filter(
      (item) => item.status !== NOTIFICATION_STATUS_DONE,
    );

    if (
      unreadNotifications.every(
        (item) => typeof item.id === "string" && typeof item.version === "number",
      )
    ) {
      return unreadNotifications as (VersionedNotificationItem & {
        id: string;
        version: number;
      })[];
    }

    try {
      const refreshedNotifications = await refreshNotifications();
      setNotifications(refreshedNotifications);

      return refreshedNotifications.filter(
        (
          item,
        ): item is VersionedNotificationItem & {
          id: string;
          version: number;
        } =>
          item.status !== NOTIFICATION_STATUS_DONE &&
          typeof item.id === "string" &&
          typeof item.version === "number",
      );
    } catch {
      return [];
    }
  }

  async function handleMarkAllAsRead() {
    if (!canUpdateNotifications || notificationsMutation.isLoading) {
      return;
    }

    const unreadNotifications = await resolveUnreadNotifications();

    if (unreadNotifications.length === 0) {
      return;
    }

    await notificationsMutation.runMutation(
      () =>
        Promise.all(
          unreadNotifications.map((item) =>
            updateNotificationRecord(
              item.id,
              { status: NOTIFICATION_STATUS_DONE },
              item.version,
            ),
          ),
        ),
      {
        fallbackErrorMessage: "Nao foi possivel atualizar as notificacoes.",
        conflictMessage: NOTIFICATIONS_CONFLICT_MESSAGE,
        isVersionConflict: isNotificationMutationConflict,
        reloadOnConflict: reloadNotificationsAfterConflict,
        getErrorMessage: getNotificationMutationErrorMessage,
        onSuccess: (updatedNotifications) => {
          const updatedById = new Map(
            updatedNotifications.map((item) => [item.id, item]),
          );

          setNotifications((currentNotifications) =>
            currentNotifications.map((item) =>
              item.id && updatedById.has(item.id)
                ? updatedById.get(item.id)!
                : item,
            ),
          );
        },
      },
    );
  }

  return (
    <section className="space-y-8">
      <Hero
        section={section}
        eyebrow="Central"
        actions={
          canUpdateNotifications ? (
            <ActionButton
              onClick={() => {
                void handleMarkAllAsRead();
              }}
            >
              Marcar tudo como lido
            </ActionButton>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total de Alertas"
          value={String(notifications.length)}
          helper="Itens registrados na central operacional"
        />
        <SummaryCard
          title="Alta Prioridade"
          value={String(
            notifications.filter((item) => item.priority === "Alta").length,
          )}
          helper="Demandam acao imediata ou aprovacao"
          tone="danger"
        />
        <SummaryCard
          title="Em Andamento"
          value={String(
            notifications.filter((item) => item.status === "Em andamento")
              .length,
          )}
          helper="Alertas ja assumidos por uma area"
          tone="warning"
        />
        <SummaryCard
          title="Pendentes"
          value={String(
            notifications.filter(
              (item) =>
                item.status !== "Em andamento" &&
                item.status !== NOTIFICATION_STATUS_DONE,
            ).length,
          )}
          helper="Ainda nao consumidos pela operacao"
          tone="warning"
        />
      </div>

      <Panel title="Caixa de entrada operacional" eyebrow="Alertas">
        <div className="space-y-4">
          {notifications.map((item) => (
            <article
              key={item.id ?? `${item.title}::${item.area}`}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">
                      {item.title}
                    </p>
                    <StatusPill
                      label={item.priority}
                      tone={toneByLabel(item.priority)}
                    />
                    <StatusPill
                      label={item.type}
                      tone="bg-[var(--accent-soft)] text-[var(--accent)]"
                    />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {item.area}
                  </p>
                </div>
                <StatusPill
                  label={item.status}
                  tone={toneByLabel(item.status)}
                />
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}
