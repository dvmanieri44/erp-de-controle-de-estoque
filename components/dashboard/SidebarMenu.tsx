"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { DASHBOARD_GROUPS, DASHBOARD_SECTIONS, DEFAULT_SECTION_ID, type DashboardSection } from "@/lib/dashboard-sections";
import {
  createUserAccountId,
  getUserRoleLabel,
  loadActiveUserAccountId,
  loadUserAccounts,
  saveActiveUserAccountId,
  saveUserAccounts,
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
  type UserAccount,
  type UserRole,
  type UserStatus,
} from "@/lib/user-accounts";
import type { NavigationBehavior, NavigationLayout } from "@/lib/ui-preferences";

type IconProps = { className?: string };
type AccountFormState = { name: string; email: string; role: UserRole; unit: string; status: UserStatus };

const EMPTY_ACCOUNT_FORM: AccountFormState = { name: "", email: "", role: "operador", unit: "", status: "ativo" };

const icons = {
  dashboard: DashboardIcon,
  notificacoes: AlertIcon,
  pendencias: FileIcon,
  produtos: BoxIcon,
  movimentacoes: MoveIcon,
  "estoque-baixo": AlertIcon,
  lotes: BoxIcon,
  qualidade: AlertIcon,
  fornecedores: UserIcon,
  categorias: FolderIcon,
  localizacoes: PinIcon,
  transferencias: MoveIcon,
  planejamento: FileIcon,
  tarefas: FileIcon,
  distribuidores: UserIcon,
  calendario: FolderIcon,
  relatorios: FileIcon,
  incidentes: AlertIcon,
  documentos: FileIcon,
  historico: HistoryIcon,
  configuracoes: SettingsIcon,
} as const;

function getHref(sectionId: string) {
  return sectionId === DEFAULT_SECTION_ID ? "/dashboard" : `/dashboard/${sectionId}`;
}

function initials(name: string) {
  const value = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return value || "US";
}

function roleTone(role: UserRole) {
  if (role === "administrador") return "bg-rose-50 text-rose-700";
  if (role === "gestor") return "bg-amber-50 text-amber-700";
  if (role === "consulta") return "bg-slate-100 text-slate-700";
  return "bg-emerald-50 text-emerald-700";
}

function DashboardIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></svg>;
}
function BoxIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M4 8.5 12 4l8 4.5-8 4.5L4 8.5Z" /><path d="M4 8.5V16l8 4 8-4V8.5" /></svg>;
}
function MoveIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M4 7h12" /><path d="m13 4 3 3-3 3" /><path d="M20 17H8" /><path d="m11 14-3 3 3 3" /></svg>;
}
function AlertIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M12 4 4 19h16L12 4Z" /><path d="M12 10v4" /></svg>;
}
function UserIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><circle cx="9" cy="9" r="3" /><path d="M4 18a5 5 0 0 1 10 0" /><path d="M16 8h4M18 6v4" /></svg>;
}
function FolderIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-10Z" /></svg>;
}
function PinIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M12 20s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
function FileIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M6 20h12a2 2 0 0 0 2-2V9l-6-6H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></svg>;
}
function HistoryIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;
}
function SettingsIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M12 3.75a2.25 2.25 0 0 1 2.21 1.82l.1.49a1.5 1.5 0 0 0 2.12 1.05l.46-.22a2.25 2.25 0 0 1 2.8.74 2.25 2.25 0 0 1-.28 2.88l-.36.35a1.5 1.5 0 0 0 0 2.12l.36.35a2.25 2.25 0 0 1 .28 2.88 2.25 2.25 0 0 1-2.8.74l-.46-.22a1.5 1.5 0 0 0-2.12 1.05l-.1.49a2.25 2.25 0 0 1-4.42 0l-.1-.49a1.5 1.5 0 0 0-2.12-1.05l-.46.22a2.25 2.25 0 0 1-2.8-.74 2.25 2.25 0 0 1 .28-2.88l.36-.35a1.5 1.5 0 0 0 0-2.12l-.36-.35a2.25 2.25 0 0 1-.28-2.88 2.25 2.25 0 0 1 2.8-.74l.46.22a1.5 1.5 0 0 0 2.12-1.05l.1-.49A2.25 2.25 0 0 1 12 3.75Z" /><circle cx="12" cy="12" r="3.25" /></svg>;
}
function LogoutIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M10 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" /><path d="M21 12H9" /><path d="m18 9 3 3-3 3" /></svg>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{label}</span>{children}</label>;
}

function NavigationLink({ section, pathname }: { section: DashboardSection; pathname: string }) {
  const href = getHref(section.id);
  const isActive = pathname === href;
  const Icon = icons[section.id as keyof typeof icons] ?? DashboardIcon;
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]" : "text-[var(--muted-foreground)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{section.label}</span>
    </Link>
  );
}

function AccountManager({
  accounts,
  activeAccount,
  setAccounts,
  setActiveAccountId,
  onClose,
}: {
  accounts: UserAccount[];
  activeAccount: UserAccount | null;
  setAccounts: (accounts: UserAccount[]) => void;
  setActiveAccountId: (id: string | null) => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { firstFieldRef.current?.focus(); }, []);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_ACCOUNT_FORM);
    setError(null);
  }

  function editAccount(account: UserAccount) {
    setEditingId(account.id);
    setForm({ name: account.name, email: account.email, role: account.role, unit: account.unit, status: account.status });
    setError(null);
  }

  function submit() {
    if (!form.name.trim() || !form.email.trim() || !form.unit.trim()) {
      setError("Preencha nome, e-mail e unidade.");
      return;
    }
    if (accounts.some((account) => account.email.toLowerCase() === form.email.trim().toLowerCase() && account.id !== editingId)) {
      setError("Já existe uma conta com esse e-mail.");
      return;
    }

    const nextAccount: UserAccount = {
      id: editingId ?? (createUserAccountId(form.name) || `conta-${Date.now()}`),
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      unit: form.unit.trim(),
      status: form.status,
    };

    if (editingId) {
      setAccounts(accounts.map((account) => (account.id === editingId ? nextAccount : account)));
    } else {
      setAccounts([nextAccount, ...accounts]);
      setActiveAccountId(nextAccount.id);
    }
    resetForm();
  }

  function removeAccount(accountId: string) {
    if (accounts.length === 1) {
      setError("Mantenha pelo menos uma conta cadastrada.");
      return;
    }
    if (activeAccount?.id === accountId) {
      setError("Troque a conta ativa antes de excluir.");
      return;
    }
    setAccounts(accounts.filter((account) => account.id !== accountId));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-5xl rounded-[32px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Contas</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--navy-900)]">Perfis e níveis de acesso</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">Troque a conta ativa, crie novos perfis e organize acessos por administrador, gestor, operador ou consulta.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={resetForm} className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">Nova conta</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">Fechar</button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-3">
            {accounts.map((account) => {
              const isActive = activeAccount?.id === account.id;
              return (
                <article key={account.id} className={`rounded-2xl border p-4 ${isActive ? "border-[var(--accent)] bg-[var(--accent-soft)]/40" : "border-[var(--panel-border)] bg-[var(--panel-soft)]"}`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">{initials(account.name)}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{account.name}</p>
                          {isActive ? <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-white">Conta ativa</span> : null}
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleTone(account.role)}`}>{getUserRoleLabel(account.role)}</span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{account.email}</p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{account.unit} · {account.status === "ativo" ? "Ativo" : "Inativo"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isActive ? <button type="button" onClick={() => setActiveAccountId(account.id)} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">Usar conta</button> : null}
                      <button type="button" onClick={() => editAccount(account)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                      <button type="button" onClick={() => removeAccount(account.id)} className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-xs font-semibold text-[#be123c]">Excluir</button>
                    </div>
                  </div>
                </article>
              );
            })}
            <button type="button" onClick={() => setActiveAccountId(null)} className="inline-flex items-center gap-2 px-1 py-2 text-sm font-semibold text-[#d74b4b] transition hover:opacity-80">
              <LogoutIcon className="h-4 w-4" />
              Encerrar sessão atual
            </button>
          </section>

          <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{editingId ? "Editar conta" : "Criar conta"}</p>
            <h3 className="mt-2 text-lg font-semibold text-[var(--navy-900)]">{editingId ? "Atualize os dados do perfil" : "Cadastre um novo perfil de acesso"}</h3>
            <div className="mt-5 space-y-4">
              <Field label="Nome"><input ref={firstFieldRef} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Supervisão de Expedição" className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
              <Field label="E-mail"><input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="conta@premierpet.com.br" className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Perfil"><select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))} className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]">{USER_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Status"><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserStatus }))} className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]">{USER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              </div>
              <Field label="Unidade / área"><input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} placeholder="Ex.: Complexo Industrial Dourado" className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" /></Field>
              <p className="text-xs text-[var(--muted-foreground)]">{USER_ROLE_OPTIONS.find((option) => option.value === form.role)?.helper}</p>
              {error ? <p className="text-sm font-medium text-[#dc2626]">{error}</p> : null}
              <div className="flex flex-wrap justify-end gap-3 pt-2">
                {editingId ? <button type="button" onClick={resetForm} className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Cancelar edição</button> : null}
                <button type="button" onClick={submit} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95">{editingId ? "Salvar alterações" : "Criar conta"}</button>
              </div>
            </div>
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
  const pathname = usePathname();
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const nextAccounts = loadUserAccounts();
      const storedActiveId = loadActiveUserAccountId();
      const fallbackActiveId = nextAccounts.find((account) => account.status === "ativo")?.id ?? nextAccounts[0]?.id ?? null;
      setAccounts(nextAccounts);
      setActiveAccountId(storedActiveId && nextAccounts.some((account) => account.id === storedActiveId) ? storedActiveId : fallbackActiveId);
      setIsLoaded(true);
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => { if (isLoaded) saveUserAccounts(accounts); }, [accounts, isLoaded]);
  useEffect(() => { if (isLoaded) saveActiveUserAccountId(activeAccountId); }, [activeAccountId, isLoaded]);

  const activeAccount = useMemo(() => accounts.find((account) => account.id === activeAccountId) ?? null, [accounts, activeAccountId]);

  if (orientation === "superior") {
    return null;
  }

  return (
    <>
      <aside className="flex w-full flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 py-5 transition-colors md:sticky md:top-0 md:h-screen md:self-start md:w-[270px]">
        <div className="mb-6 px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">PremieRpet</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Operações e Estoque</p>
        </div>

        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-5">
            {DASHBOARD_GROUPS.map((group) => (
              <section key={group.id}>
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{group.label}</p>
                <div className="space-y-1">
                  {DASHBOARD_SECTIONS.filter((section) => section.group === group.id).map((section) => (
                    <NavigationLink key={section.id} section={section} pathname={pathname} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </nav>

        <div className="mt-4 border-t border-[var(--sidebar-border)] pt-4">
          <div className="space-y-1">
            {DASHBOARD_SECTIONS.filter((section) => section.group === "configuracoes").map((section) => (
              <NavigationLink key={section.id} section={section} pathname={pathname} />
            ))}
          </div>

          <button type="button" onClick={() => setIsAccountManagerOpen(true)} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-[var(--panel-soft)] px-3 py-3 text-left transition hover:bg-[var(--panel)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">{initials(activeAccount?.name ?? "Sem sessão")}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">{activeAccount?.name ?? "Sem sessão ativa"}</p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">{activeAccount ? `${getUserRoleLabel(activeAccount.role)} · ${activeAccount.unit}` : "Clique para selecionar uma conta"}</p>
            </div>
          </button>

          <button type="button" onClick={() => setActiveAccountId(null)} className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#d74b4b] transition hover:opacity-80">
            <LogoutIcon className="h-4 w-4" />
            Encerrar sessão
          </button>
        </div>
      </aside>

      {isAccountManagerOpen ? (
        <AccountManager
          accounts={accounts}
          activeAccount={activeAccount}
          setAccounts={setAccounts}
          setActiveAccountId={setActiveAccountId}
          onClose={() => setIsAccountManagerOpen(false)}
        />
      ) : null}
    </>
  );
}
