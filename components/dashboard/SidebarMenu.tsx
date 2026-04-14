"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type JSX } from "react";

import { USER_ACCOUNTS_EVENT } from "@/lib/app-events";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  DEFAULT_SECTION_ID,
  getDashboardGroups,
  getDashboardSections,
  type DashboardSection,
} from "@/lib/dashboard-sections";
import {
  clearCachedUserAccounts,
  getUserRoleLabel,
  getUserRoleOptions,
  getUserStatusLabel,
  getUserStatusOptions,
  loadUserAccounts,
  normalizeLoginUsername,
  saveUserAccounts,
  type UserAccount,
  type UserRole,
  type UserStatus,
} from "@/lib/user-accounts";
import type { NavigationBehavior, NavigationLayout } from "@/lib/ui-preferences";

type AccountFormState = {
  name: string;
  username: string;
  email: string;
  role: UserRole;
  unit: string;
  status: UserStatus;
  password: string;
  confirmPassword: string;
};

type AuthSessionResponse = {
  authenticated?: boolean;
  account?: UserAccount | null;
};

type ManagedAccountsResponse = {
  accounts?: UserAccount[];
  account?: UserAccount | null;
  error?: string;
};

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  name: "",
  username: "",
  email: "",
  role: "operador",
  unit: "",
  status: "ativo",
  password: "",
  confirmPassword: "",
};

const COPY = {
  "pt-BR": {
    appSubtitle: "Operacoes e Estoque",
    noSession: "Sem sessao",
    noActiveSession: "Sem sessao ativa",
    clickSelect: "Clique para selecionar uma conta",
    signOut: "Encerrar sessao",
  },
  "en-US": {
    appSubtitle: "Operations and Inventory",
    noSession: "No session",
    noActiveSession: "No active session",
    clickSelect: "Click to select an account",
    signOut: "Sign out",
  },
  "es-ES": {
    appSubtitle: "Operaciones e Inventario",
    noSession: "Sin sesion",
    noActiveSession: "Sin sesion activa",
    clickSelect: "Haz clic para seleccionar una cuenta",
    signOut: "Cerrar sesion",
  },
} as const;

const MIN_PASSWORD_LENGTH = 8;

function roleLevel(role: UserRole) {
  if (role === "administrador") return 4;
  if (role === "gestor") return 3;
  if (role === "operador") return 2;
  return 1;
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "US"
  );
}

function areAccountsEqual(current: UserAccount[], next: UserAccount[]) {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((account, index) => {
    const nextAccount = next[index];

    return (
      nextAccount !== undefined &&
      account.id === nextAccount.id &&
      account.name === nextAccount.name &&
      account.username === nextAccount.username &&
      account.email === nextAccount.email &&
      account.role === nextAccount.role &&
      account.unit === nextAccount.unit &&
      account.status === nextAccount.status
    );
  });
}

function resolveActiveAccountId(accounts: UserAccount[], candidateId: string | null) {
  if (!candidateId) {
    return null;
  }

  return accounts.some((account) => account.id === candidateId && account.status === "ativo") ? candidateId : null;
}

function getHref(sectionId: string) {
  return sectionId === DEFAULT_SECTION_ID ? "/dashboard" : `/dashboard/${sectionId}`;
}

function DashboardIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="10" width="7" height="11" rx="2" /><rect x="3" y="12" width="7" height="9" rx="2" /></svg>;
}
function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
}
function ClipboardIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 4.5h6v3H9zM9 10h6M9 14h6" /></svg>;
}
function BoxIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M4 8.5 12 4l8 4.5-8 4.5L4 8.5Z" /><path d="M4 8.5V16l8 4 8-4V8.5" /></svg>;
}
function MoveIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M4 7h12" /><path d="m13 4 3 3-3 3" /><path d="M20 17H8" /><path d="m11 14-3 3 3 3" /></svg>;
}
function WarningIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M12 4 4 19h16L12 4Z" /><path d="M12 10v4" /><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" /></svg>;
}
function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M12 3 5 6v6c0 4.5 2.8 7.7 7 9 4.2-1.3 7-4.5 7-9V6l-7-3Z" /><path d="M9.5 12.5 11 14l3.5-4" /></svg>;
}
function TruckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M3 7h11v8H3z" /><path d="M14 10h4l3 3v2h-7z" /><circle cx="8" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>;
}
function LayersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M12 4 4 8l8 4 8-4-8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 16 8 4 8-4" /></svg>;
}
function MapPinIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M12 20s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
}
function ChartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M4 19h16" /><path d="M7 15v-4M12 15V7M17 15v-7" /></svg>;
}
function FileIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M6 20h12a2 2 0 0 0 2-2V9l-6-6H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></svg>;
}
function HistoryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;
}
function TraceabilityIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="6.5" r="2.5" /><circle cx="12" cy="17.5" r="2.5" /><path d="M8.6 7.9 10.5 9.3" /><path d="M15.4 7.9 13.5 9.3" /><path d="M11.2 15.1 8 8.8" /><path d="M12.8 15.1 16 8.8" /></svg>;
}
function RocketIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M14 4c3.5 0 6 2.5 6 6-3.5 0-6-2.5-6-6Z" /><path d="m5 19 4.5-4.5M9 10l5 5M7 12c-.8-2.6-.3-5.6 2-7 1.4 2.9.8 6.1-1 8" /><path d="M12 17c2.6.8 5.6.3 7-2-2.9-1.4-6.1-.8-8 1" /></svg>;
}
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M12 3.75a2.25 2.25 0 0 1 2.21 1.82l.1.49a1.5 1.5 0 0 0 2.12 1.05l.46-.22a2.25 2.25 0 0 1 2.8.74 2.25 2.25 0 0 1-.28 2.88l-.36.35a1.5 1.5 0 0 0 0 2.12l.36.35a2.25 2.25 0 0 1 .28 2.88 2.25 2.25 0 0 1-2.8.74l-.46-.22a1.5 1.5 0 0 0-2.12 1.05l-.1.49a2.25 2.25 0 0 1-4.42 0l-.1-.49a1.5 1.5 0 0 0-2.12-1.05l-.46.22a2.25 2.25 0 0 1-2.8-.74 2.25 2.25 0 0 1 .28-2.88l.36-.35a1.5 1.5 0 0 0 0-2.12l-.36-.35a2.25 2.25 0 0 1-.28-2.88 2.25 2.25 0 0 1 2.8-.74l.46.22a1.5 1.5 0 0 0 2.12-1.05l.1-.49A2.25 2.25 0 0 1 12 3.75Z" /><circle cx="12" cy="12" r="3.25" /></svg>;
}
function LogoutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M15 3h-5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" /><path d="M11 12h10" /><path d="m18 8 4 4-4 4" /></svg>;
}
const SECTION_ICONS: Record<string, () => JSX.Element> = {
  dashboard: DashboardIcon,
  notificacoes: BellIcon,
  pendencias: ClipboardIcon,
  rastreabilidade: TraceabilityIcon,
  produtos: BoxIcon,
  movimentacoes: MoveIcon,
  "estoque-baixo": WarningIcon,
  lotes: LayersIcon,
  qualidade: ShieldIcon,
  fornecedores: TruckIcon,
  categorias: LayersIcon,
  localizacoes: MapPinIcon,
  transferencias: MoveIcon,
  planejamento: ClipboardIcon,
  tarefas: ClipboardIcon,
  distribuidores: TruckIcon,
  calendario: CalendarIcon,
  relatorios: ChartIcon,
  incidentes: WarningIcon,
  documentos: FileIcon,
  historico: HistoryIcon,
  roadmap: RocketIcon,
  configuracoes: SettingsIcon,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

function NavigationLink({ section, pathname }: { section: DashboardSection; pathname: string }) {
  const href = getHref(section.id);
  const isActive = pathname === href;
  const Icon = SECTION_ICONS[section.id] ?? FileIcon;

  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]" : "text-[var(--muted-foreground)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"}`}>
      <Icon />
      <span>{section.label}</span>
    </Link>
  );
}

function AccountManager({
  accounts,
  activeAccount,
  onAccountsChange,
  onActiveAccountChange,
  onClose,
}: {
  accounts: UserAccount[];
  activeAccount: UserAccount | null;
  onAccountsChange: (accounts: UserAccount[]) => void;
  onActiveAccountChange: (id: string | null) => void;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const roleOptions = getUserRoleOptions(locale);
  const statusOptions = getUserStatusOptions(locale);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);
  const [securityPassword, setSecurityPassword] = useState("");
  const [error, setError] = useState("");
  const canViewOthers = activeAccount ? roleLevel(activeAccount.role) >= roleLevel("gestor") : false;
  const visibleAccounts = canViewOthers && activeAccount ? accounts : activeAccount ? [activeAccount] : [];
  const allowedRoles = useMemo(
    () =>
      !activeAccount || !canViewOthers
        ? []
        : roleOptions.filter((option) =>
            activeAccount.role === "administrador"
              ? true
              : roleLevel(option.value) < roleLevel(activeAccount.role),
          ),
    [activeAccount, canViewOthers, roleOptions],
  );

  useEffect(() => {
    if (allowedRoles.length === 0) return;
    setForm((current) =>
      allowedRoles.some((option) => option.value === current.role)
        ? current
        : { ...current, role: allowedRoles[0].value },
    );
  }, [allowedRoles]);

  function canManageTarget(account: UserAccount) {
    if (!activeAccount) return false;
    if (activeAccount.role === "administrador") return true;
    return roleLevel(account.role) < roleLevel(activeAccount.role);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_ACCOUNT_FORM, role: allowedRoles[0]?.value ?? "operador" });
    setError("");
  }

  function handleEdit(account: UserAccount) {
    if (!canManageTarget(account)) {
      setError("Sua conta nao pode editar esse perfil.");
      return;
    }
    setEditingId(account.id);
    setForm({
      name: account.name,
      username: account.username,
      email: account.email,
      role: account.role,
      unit: account.unit,
      status: account.status,
      password: "",
      confirmPassword: "",
    });
    setError("");
  }

  async function handleSubmit() {
    const normalizedUsername = normalizeLoginUsername(form.username);
    const trimmedPassword = form.password.trim();

    if (!form.name.trim() || !normalizedUsername || !form.email.trim() || !form.unit.trim()) {
      setError("Preencha nome, usuario, e-mail e unidade.");
      return;
    }
    if (!securityPassword.trim()) {
      setError("Informe sua senha atual para continuar.");
      return;
    }
    if (
      accounts.some(
        (account) =>
          account.email.toLowerCase() === form.email.trim().toLowerCase() && account.id !== editingId,
      )
    ) {
      setError("Ja existe uma conta com esse e-mail.");
      return;
    }
    if (
      accounts.some(
        (account) => account.username.toLowerCase() === normalizedUsername && account.id !== editingId,
      )
    ) {
      setError("Ja existe uma conta com esse usuario de acesso.");
      return;
    }
    if (!allowedRoles.some((option) => option.value === form.role)) {
      setError("Seu perfil nao pode criar ou promover essa credencial.");
      return;
    }
    if (trimmedPassword.length > 0 && trimmedPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (!editingId && trimmedPassword.length === 0) {
      setError("Defina uma senha para a nova conta.");
      return;
    }
    if (trimmedPassword !== form.confirmPassword.trim()) {
      setError("A confirmacao da senha nao confere.");
      return;
    }

    const accountPayload = {
      name: form.name.trim(),
      username: normalizedUsername,
      email: form.email.trim(),
      role: form.role,
      unit: form.unit.trim(),
      status: form.status,
    };

    try {
      const endpoint = editingId ? `/api/auth/accounts/${encodeURIComponent(editingId)}` : "/api/auth/accounts";
      const response = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: securityPassword,
          password: trimmedPassword.length > 0 ? trimmedPassword : undefined,
          account: accountPayload,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ManagedAccountsResponse | null;

      if (!response.ok || !Array.isArray(payload?.accounts)) {
        setError(payload?.error ?? "Nao foi possivel salvar a conta agora.");
        return;
      }

      onAccountsChange(payload.accounts);
      setSecurityPassword("");
      resetForm();
    } catch {
      setError("Nao foi possivel salvar a conta agora.");
    }
  }

  async function handleDelete(account: UserAccount) {
    if (activeAccount?.id === account.id) {
      setError("Troque a conta ativa antes de excluir.");
      return;
    }
    if (!canManageTarget(account)) {
      setError("Sua conta nao pode excluir esse perfil.");
      return;
    }
    if (!securityPassword.trim()) {
      setError("Informe sua senha atual para continuar.");
      return;
    }

    try {
      const response = await fetch(`/api/auth/accounts/${encodeURIComponent(account.id)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: securityPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ManagedAccountsResponse | null;

      if (!response.ok || !Array.isArray(payload?.accounts)) {
        setError(payload?.error ?? "Nao foi possivel excluir a conta agora.");
        return;
      }

      onAccountsChange(payload.accounts);
      setSecurityPassword("");
      resetForm();
    } catch {
      setError("Nao foi possivel excluir a conta agora.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-5xl rounded-[32px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Contas</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--navy-900)]">Perfis e niveis de acesso</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
              Administrador ve e cria qualquer conta. Gestor ve as contas cadastradas, mas so cria perfis abaixo dele.
            </p>
          </div>
          <div className="flex gap-3">
            {canViewOthers ? <button type="button" onClick={resetForm} className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">Nova conta</button> : null}
            <button type="button" onClick={onClose} className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">Fechar</button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-3">
            {visibleAccounts.map((account) => (
              <article key={account.id} className={`rounded-2xl border p-4 ${activeAccount?.id === account.id ? "border-[var(--accent)] bg-[var(--accent-soft)]/40" : "border-[var(--panel-border)] bg-[var(--panel-soft)]"}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">{initials(account.name)}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{account.name}</p>
                        {activeAccount?.id === account.id ? <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-white">Conta ativa</span> : null}
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{getUserRoleLabel(account.role, locale)}</span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-[var(--accent)]">@{account.username}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{account.email}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{account.unit} · {getUserStatusLabel(account.status, locale)}</p>
                    </div>
                  </div>

                  {canViewOthers ? (
                    <div className="flex flex-wrap gap-2">
                      {activeAccount?.id !== account.id ? <button type="button" disabled className="cursor-not-allowed rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">Trocar apos sair</button> : null}
                      {canManageTarget(account) ? <button type="button" onClick={() => handleEdit(account)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button> : null}
                      {canManageTarget(account) ? <button type="button" onClick={() => { void handleDelete(account); }} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Excluir</button> : null}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}

            <button type="button" onClick={() => onActiveAccountChange(null)} className="inline-flex items-center gap-2 px-1 py-2 text-sm font-semibold text-[#d74b4b] transition hover:opacity-80">
              <LogoutIcon />
              Encerrar sessao atual
            </button>
          </section>

          <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-5">
            {canViewOthers ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{editingId ? "Editar conta" : "Criar conta"}</p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--navy-900)]">{editingId ? "Atualize os dados do perfil" : "Cadastre um novo perfil de acesso"}</h3>
                <div className="mt-5 space-y-4">
                  <Field label="Nome"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Supervisao de Expedicao" className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
                  <Field label="Usuario"><input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="Ex.: supervisao.expedicao" className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
                  <Field label="E-mail"><input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="conta@premierpet.com.br" className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Perfil"><select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))} className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]">{allowedRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                    <Field label="Status"><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserStatus }))} className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]">{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                  </div>
                  <Field label="Unidade / area"><input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} placeholder="Ex.: Complexo Industrial Dourado" className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={editingId ? "Nova senha" : "Senha de acesso"}><input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder={editingId ? "Preencha so se quiser redefinir" : "Defina a senha da conta"} className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
                    <Field label="Confirmar senha"><input type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Repita a senha informada" className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
                  </div>
                  <Field label="Sua senha atual"><input type="password" value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} placeholder="Confirme sua senha para autorizar mudancas" className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
                  <p className="text-xs text-[var(--muted-foreground)]">Administrador cria qualquer perfil. Gestor so cria operador e consulta. Senhas novas precisam ter pelo menos 8 caracteres.</p>
                  {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
                  <div className="flex flex-wrap justify-end gap-3 pt-2">
                    {editingId ? <button type="button" onClick={resetForm} className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Cancelar edicao</button> : null}
                     <button type="button" onClick={() => { void handleSubmit(); }} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95">{editingId ? "Salvar alteracoes" : "Criar conta"}</button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Visibilidade restrita</p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--navy-900)]">{activeAccount?.name ?? "Sem sessao ativa"}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">Sua conta pode visualizar apenas o proprio perfil. Para trocar de usuario, encerre a sessao atual e faca novo login.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function SidebarMenu({
  orientation = "lateral",
}: {
  orientation?: NavigationLayout;
  behavior?: NavigationBehavior;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const copy = COPY[locale];
  const pathname = usePathname();
  const sections = useMemo(() => getDashboardSections(locale), [locale]);
  const groups = useMemo(() => getDashboardGroups(locale), [locale]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const sync = async () => {
      let nextAccounts = loadUserAccounts();
      let nextActiveId: string | null = null;

      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });

        if (response.ok) {
          const payload = (await response.json()) as AuthSessionResponse;
          const sessionAccount = payload.account ?? null;

          if (
            sessionAccount &&
            !nextAccounts.some((account) => account.id === sessionAccount.id)
          ) {
            nextAccounts = [sessionAccount, ...nextAccounts];
          }

          nextActiveId = resolveActiveAccountId(nextAccounts, payload.account?.id ?? null);
        } else if (response.status === 401) {
          nextAccounts = [];
        }
      } catch {
        nextActiveId = null;
      }

      if (!isMounted) {
        return;
      }

      setAccounts((current) => (areAccountsEqual(current, nextAccounts) ? current : nextAccounts));
      setActiveAccountId((current) => (current === nextActiveId ? current : nextActiveId));
    };

    const handleSyncEvent = () => {
      void sync();
    };

    void sync();
    window.addEventListener("storage", handleSyncEvent);
    window.addEventListener(USER_ACCOUNTS_EVENT, handleSyncEvent);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleSyncEvent);
      window.removeEventListener(USER_ACCOUNTS_EVENT, handleSyncEvent);
    };
  }, []);

  function handleActiveAccountChange(nextActiveAccountId: string | null) {
    const resolvedActiveAccountId = resolveActiveAccountId(accounts, nextActiveAccountId);

    setActiveAccountId((current) => (current === resolvedActiveAccountId ? current : resolvedActiveAccountId));

    if (resolvedActiveAccountId !== null) {
      return;
    }

    clearCachedUserAccounts();
    void fetch("/api/auth/logout", {
      method: "POST",
    }).finally(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  function handleAccountsChange(nextAccounts: UserAccount[]) {
    const resolvedActiveAccountId = resolveActiveAccountId(nextAccounts, activeAccountId);

    setAccounts((current) => (areAccountsEqual(current, nextAccounts) ? current : nextAccounts));
    saveUserAccounts(nextAccounts);

    if (resolvedActiveAccountId !== activeAccountId) {
      setActiveAccountId(resolvedActiveAccountId);

      if (resolvedActiveAccountId === null) {
        clearCachedUserAccounts();
        void fetch("/api/auth/logout", {
          method: "POST",
        }).finally(() => {
          router.replace("/login");
          router.refresh();
        });
      }
    }
  }

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  if (orientation === "superior") {
    return null;
  }

  return (
    <>
      <aside className="flex w-full flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 py-5 transition-colors md:sticky md:top-0 md:h-screen md:self-start md:w-[270px]">
        <div className="mb-6 px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Fluxy</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{copy.appSubtitle}</p>
        </div>

        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.id}>
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{group.label}</p>
                <div className="space-y-1">
                  {sections.filter((section) => section.group === group.id).map((section) => (
                    <NavigationLink key={section.id} section={section} pathname={pathname} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </nav>

        <div className="mt-4 border-t border-[var(--sidebar-border)] pt-4">
          <div className="space-y-1">
            {sections.filter((section) => section.group === "configuracoes").map((section) => (
              <NavigationLink key={section.id} section={section} pathname={pathname} />
            ))}
          </div>

          <button type="button" onClick={() => setIsAccountManagerOpen(true)} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-[var(--panel-soft)] px-3 py-3 text-left transition hover:bg-[var(--panel)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">{initials(activeAccount?.name ?? copy.noSession)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">{activeAccount?.name ?? copy.noActiveSession}</p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">{activeAccount ? `${getUserRoleLabel(activeAccount.role, locale)} · ${activeAccount.unit}` : copy.clickSelect}</p>
            </div>
          </button>

          <button type="button" onClick={() => handleActiveAccountChange(null)} className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#d74b4b] transition hover:opacity-80">
            <LogoutIcon />
            {copy.signOut}
          </button>
        </div>
      </aside>

      {isAccountManagerOpen ? (
        <AccountManager
          accounts={accounts}
          activeAccount={activeAccount}
          onAccountsChange={handleAccountsChange}
          onActiveAccountChange={handleActiveAccountChange}
          onClose={() => setIsAccountManagerOpen(false)}
        />
      ) : null}
    </>
  );
}
