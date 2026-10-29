"use client";

import { useState, useTransition } from "react";
import { Pencil, Target, Trash2, WalletCards } from "lucide-react";
import { deleteBudget, deleteGoal, updateBudget, updateGoal } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Budget, Category, Empty, Field, GoalType, brl } from "@/components/finance/shared";
import { FormDialog } from "@/components/finance/form-dialog";

export function EditGoalDialog({ goal }: { goal: GoalType }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        await updateGoal(goal.id, form);
        setOpen(false);
        toast.success("Meta atualizada.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a meta.",
        );
      }
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${goal.name}`}
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar meta financeira</DialogTitle>
          <DialogDescription>
            Atualize os valores e o prazo do objetivo.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" defaultValue={goal.name} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Objetivo">
              <Input
                name="target"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={(goal.targetCents / 100).toFixed(2)}
                required
              />
            </Field>
            <Field label="Valor atual">
              <Input
                name="current"
                type="number"
                min="0"
                step="0.01"
                defaultValue={(goal.currentCents / 100).toFixed(2)}
                required
              />
            </Field>
          </div>
          <Field label="Prazo">
            <Input
              name="deadline"
              type="date"
              defaultValue={goal.deadline ?? ""}
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditBudgetDialog({ budget, categories }: { budget: Budget; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        await updateBudget(budget.id, form);
        setOpen(false);
        toast.success("Orçamento atualizado.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o orçamento.",
        );
      }
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${budget.name}`}
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar orçamento</DialogTitle>
          <DialogDescription>
            Atualize o limite planejado para o mês.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" defaultValue={budget.name} required />
          </Field>
          <Field label="Categoria monitorada">
            <Select name="categoryId" defaultValue={budget.categoryId ? String(budget.categoryId) : undefined} required>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
              <SelectContent>
                {categories.filter((category) => category.type === "expense").map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Limite mensal">
            <Input
              name="limit"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={(budget.limitCents / 100).toFixed(2)}
              required
            />
          </Field>
          <Field label="Mês">
            <Input
              name="month"
              type="month"
              defaultValue={budget.month}
              required
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlanningView({
  goals,
  budgets,
  categories,
}: {
  goals: GoalType[];
  budgets: Budget[];
  categories: Category[];
}) {
  async function removeGoal(goal: GoalType) {
    if (!window.confirm(`Excluir a meta “${goal.name}”?`)) return;
    try {
      await deleteGoal(goal.id);
      toast.success("Meta excluída.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a meta.",
      );
    }
  }
  async function removeBudget(budget: Budget) {
    if (!window.confirm(`Excluir o orçamento “${budget.name}”?`)) return;
    try {
      await deleteBudget(budget.id);
      toast.success("Orçamento excluído.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o orçamento.",
      );
    }
  }
  const maxBudget = Math.max(...budgets.map((budget) => budget.limitCents), 1);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Metas financeiras</CardTitle>
            <CardDescription>
              Acompanhe o progresso dos objetivos
            </CardDescription>
          </div>
          <FormDialog type="goal" categories={categories} />
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {goals.length ? (
            goals.map((g) => {
              const p = Math.min(
                100,
                Math.round((g.currentCents / g.targetCents) * 100),
              );
              return (
                <div
                  key={g.id}
                  className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-primary shadow-inner">
                    <Target className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold">{g.name}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="mr-1 font-mono text-sm font-semibold">
                          {p}%
                        </span>
                        <EditGoalDialog goal={g} />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Excluir ${g.name}`}
                          onClick={() => void removeGoal(g)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <Progress value={p} className="mt-2 h-2" />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {brl(g.currentCents)} de {brl(g.targetCents)}
                      </span>
                      {g.deadline && (
                        <span>
                          Prazo: {new Date(`${g.deadline}T12:00:00`).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty text="Crie sua primeira meta financeira." />
          )}
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Orçamentos</CardTitle>
            <CardDescription>Limites planejados por mês</CardDescription>
          </div>
          <FormDialog type="budget" categories={categories} />
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {budgets.length ? (
            budgets.map((b) => {
              const share = Math.max(6, Math.round((b.limitCents / maxBudget) * 100));
              return <div key={b.id} className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-primary shadow-inner">
                  <WalletCards className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-semibold">{b.name}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="mr-1 font-mono text-sm font-semibold">{brl(b.limitCents)}</span>
                      <EditBudgetDialog budget={b} categories={categories} />
                      <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${b.name}`} onClick={() => void removeBudget(b)}><Trash2 /></Button>
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{width:`${share}%`}} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Limite mensal</span>
                    <span>{new Date(`${b.month}-01T12:00:00`).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</span>
                  </div>
                </div>
              </div>;
            })
          ) : (
            <Empty text="Defina um orçamento para controlar seus limites." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
