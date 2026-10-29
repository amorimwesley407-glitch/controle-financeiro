"use client";

import { useState } from "react";
import { compoundProjection, getSpendingAlerts } from "@/lib/finance";
import { Bell, Calculator, CalendarDays, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Empty, Field, Tx, brl } from "@/components/finance/shared";

export function ToolsView({
  transactions,
  income,
  expense,
  savings,
}: {
  transactions: Tx[];
  income: number;
  expense: number;
  savings: number;
}) {
  const [initial, setInitial] = useState(1000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(5);
  const future = compoundProjection(initial, monthly, rate, years);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTransactions = transactions.filter((item) =>
    item.date.startsWith(currentMonth),
  );
  const alerts = getSpendingAlerts(transactions, income, expense, savings);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" />
            Calendário financeiro
          </CardTitle>
          <CardDescription>
            Lançamentos de{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthTransactions.length ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from(
                {
                  length: new Date(
                    Number(currentMonth.slice(0, 4)),
                    Number(currentMonth.slice(5, 7)),
                    0,
                  ).getDate(),
                },
                (_, index) => {
                  const day = index + 1;
                  const date = `${currentMonth}-${String(day).padStart(2, "0")}`;
                  const items = monthTransactions.filter(
                    (item) => item.date === date,
                  );
                  return (
                    <div
                      key={day}
                      className={`min-h-20 rounded-lg border p-2 ${items.length ? "bg-muted/45" : ""}`}
                    >
                      <p className="text-xs font-medium text-muted-foreground">
                        {day}
                      </p>
                      {items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          title={item.description}
                          className={`mt-1 truncate rounded px-1 py-0.5 text-[10px] ${item.type === "income" ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive"}`}
                        >
                          {item.description}
                        </div>
                      ))}
                      {items.length > 2 && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          +{items.length - 2}
                        </p>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          ) : (
            <Empty text="Não há lançamentos no mês atual." />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="size-5" />
            Simulador de juros compostos
          </CardTitle>
          <CardDescription>
            Projete o crescimento de uma reserva ou investimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor inicial (R$)">
              <Input
                type="number"
                min="0"
                value={initial}
                onChange={(e) =>
                  setInitial(Math.max(0, Number(e.target.value)))
                }
              />
            </Field>
            <Field label="Aporte mensal (R$)">
              <Input
                type="number"
                min="0"
                value={monthly}
                onChange={(e) =>
                  setMonthly(Math.max(0, Number(e.target.value)))
                }
              />
            </Field>
            <Field label="Rentabilidade anual (%)">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(Math.max(0, Number(e.target.value)))}
              />
            </Field>
            <Field label="Prazo (anos)">
              <Input
                type="number"
                min="1"
                max="60"
                value={years}
                onChange={(e) =>
                  setYears(Math.min(60, Math.max(1, Number(e.target.value))))
                }
              />
            </Field>
          </div>
          <div className="mt-5 rounded-xl bg-primary p-5 text-primary-foreground">
            <p className="text-sm opacity-75">Patrimônio estimado</p>
            <p className="mt-1 font-mono text-3xl font-semibold">
              {brl(future * 100)}
            </p>
            <p className="mt-2 text-xs opacity-70">
              Simulação educativa; rentabilidade não é garantida.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Alertas inteligentes
          </CardTitle>
          <CardDescription>
            Sinais gerados a partir do seu comportamento financeiro
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {alerts.map((alert, index) => (
            <div
              key={alert}
              className="flex gap-3 rounded-xl border p-3 text-sm"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs">
                {index + 1}
              </span>
              <p className="leading-relaxed">{alert}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Fechamento mensal</CardTitle>
          <CardDescription>Resumo consolidado do mês atual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="mt-1 font-mono font-semibold">
                {brl(
                  monthTransactions
                    .filter((t) => t.type === "income")
                    .reduce((sum, t) => sum + t.amountCents, 0),
                )}
              </p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="mt-1 font-mono font-semibold">
                {brl(
                  monthTransactions
                    .filter((t) => t.type === "expense")
                    .reduce((sum, t) => sum + t.amountCents, 0),
                )}
              </p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Movimentações</p>
              <p className="mt-1 font-mono font-semibold">
                {monthTransactions.length}
              </p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Economia geral</p>
              <p className="mt-1 font-mono font-semibold">{savings}%</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => window.print()}
          >
            <Printer data-icon="inline-start" />
            Imprimir ou salvar em PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
