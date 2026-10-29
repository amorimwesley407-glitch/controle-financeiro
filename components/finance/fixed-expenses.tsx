"use client";

import { Repeat } from "lucide-react";
import { getFixedExpenses } from "@/lib/finance";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, Tx, brl } from "@/components/finance/shared";

export function FixedExpensesCard({
  transactions,
  currentDate,
}: {
  transactions: Tx[];
  currentDate: string;
}) {
  const { items, totalCents, shareOfIncome } = getFixedExpenses(transactions, currentDate);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Gastos fixos</CardTitle>
          <CardDescription>
            Contas que se repetem todo mês, encontradas nos lançamentos dos últimos 6 meses
          </CardDescription>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground">
          <Repeat className="size-5" />
        </span>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border bg-muted/35 p-4">
              <p className="font-mono text-3xl font-semibold">
                {brl(totalCents)}
                <span className="ml-1 text-base font-normal text-muted-foreground">/mês</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {brl(totalCents * 12)} por ano
                {shareOfIncome !== null && ` · ${shareOfIncome}% da sua renda média`}
              </p>
            </div>
            <div className="flex flex-col divide-y">
              {items.map((item) => (
                <div
                  key={item.description}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.categoryName ?? "Sem categoria"} · em {item.months} dos últimos 6 meses
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.paidThisMonth && <Badge variant="outline">ainda não caiu este mês</Badge>}
                    <span className="font-mono font-medium">{brl(item.monthlyCents)}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Entram despesas com a mesma descrição e valor parecido em pelo menos 3 meses, ou marcadas como recorrentes.
              Se parar de aparecer por dois meses, sai da lista.
            </p>
          </div>
        ) : (
          <Empty text="Nenhum gasto fixo encontrado ainda. Eles aparecem quando a mesma despesa se repete por 3 meses." />
        )}
      </CardContent>
    </Card>
  );
}
