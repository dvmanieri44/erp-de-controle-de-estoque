"use client";

import type { ComponentType } from "react";

import { CalendarModule } from "@/components/dashboard/operations/CalendarModule";
import { CategoriesModule } from "@/components/dashboard/operations/CategoriesModule";
import { DocumentsModule } from "@/components/dashboard/operations/DocumentsModule";
import { DistributorsModule } from "@/components/dashboard/operations/DistributorsModule";
import { HistoryModule } from "@/components/dashboard/operations/HistoryModule";
import { IncidentsModule } from "@/components/dashboard/operations/IncidentsModule";
import { LotsModule } from "@/components/dashboard/operations/LotsModule";
import { LowStockModule } from "@/components/dashboard/operations/LowStockModule";
import { NotificationsModule } from "@/components/dashboard/operations/NotificationsModule";
import { PendingModule } from "@/components/dashboard/operations/PendingModule";
import { PlanningModule } from "@/components/dashboard/operations/PlanningModule";
import { ProductsModule } from "@/components/dashboard/operations/ProductsModule";
import { QualityEventsModule } from "@/components/dashboard/operations/QualityEventsModule";
import { ReportsModule } from "@/components/dashboard/operations/ReportsModule";
import { SuppliersModule } from "@/components/dashboard/operations/SuppliersModule";
import { TasksModule } from "@/components/dashboard/operations/TasksModule";
import { Hero } from "@/components/dashboard/operations/ui";
import type { DashboardSection } from "@/lib/dashboard-sections";

type OperationsModuleProps = {
  section: DashboardSection;
};

type OperationsModuleRenderer = ComponentType<OperationsModuleProps>;

const OPERATIONS_MODULES: Partial<
  Record<DashboardSection["id"], OperationsModuleRenderer>
> = {
  notificacoes: NotificationsModule,
  pendencias: PendingModule,
  produtos: ProductsModule,
  "estoque-baixo": LowStockModule,
  lotes: LotsModule,
  qualidade: QualityEventsModule,
  fornecedores: SuppliersModule,
  categorias: CategoriesModule,
  planejamento: PlanningModule,
  tarefas: TasksModule,
  distribuidores: DistributorsModule,
  calendario: CalendarModule,
  relatorios: ReportsModule,
  incidentes: IncidentsModule,
  documentos: DocumentsModule,
  historico: HistoryModule,
};

export function OperationsModuleScreen({ section }: OperationsModuleProps) {
  const Module = OPERATIONS_MODULES[section.id];

  if (Module) {
    return <Module section={section} />;
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Fluxy" />
    </section>
  );
}
