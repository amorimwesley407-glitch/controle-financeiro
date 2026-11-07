"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { getAnnualSummary, isDeductibleCategory } from "@/lib/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Empty, Tx, brl } from "@/components/finance/shared";

const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");

function CategoryList({ title, items }: { title: string; items: { name: string; totalCents: number; deductible: boolean }[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      {items.length ? (
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {items.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{item.name}</span>
                {item.deductible && <Badge variant="secondary" className="shrink-0">Dedutível</Badge>}
              </span>
              <span className="shrink-0 font-mono">{brl(item.totalCents)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nada lançado.</p>
      )}
    </div>
  );
}

/**
 * Totais do ano por categoria e as despesas com saúde e educação, que podem ser deduzidas no Imposto de Renda.
 * Abre no ano anterior, o da declaração, quando ele tem lançamentos.
 */
export function AnnualReportCard({ transactions, currentDate }: { transactions: Tx[]; currentDate: string }) {
  const years = useMemo(
    () => [...new Set(transactions.filter((item) => item.date <= currentDate).map((item) => item.date.slice(0, 4)))].sort().reverse(),
    [transactions, currentDate],
  );
  const currentYear = currentDate.slice(0, 4);
  const lastYear = String(Number(currentYear) - 1);
  const [year, setYear] = useState(years.includes(lastYear) ? lastYear : currentYear);
  const summary = useMemo(() => getAnnualSummary(transactions, year, currentDate), [transactions, year, currentDate]);
  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = transactions
      .filter((item) => item.date.startsWith(`${year}-`) && item.date <= currentDate)
      .sort((a, b) => a.date.localeCompare(b.date));
    const lines = [
      ["Data", "Descrição", "Tipo", "Categoria", "Valor", "Dedutível"],
      ...rows.map((item) => [
        item.date,
        item.description,
        item.type === "income" ? "Receita" : "Despesa",
        item.categoryName ?? "",
        (item.amountCents / 100).toFixed(2).replace(".", ","),
        item.type === "expense" && isDeductibleCategory(item.categoryName) ? "Sim" : "",
      ]),
    ].map((line) => line.map((value) => escape(String(value))).join(";"));
    const url = URL.createObjectURL(new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `clareza-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Lançamentos de ${year} exportados.`);
  }
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Resumo anual e Imposto de Renda</CardTitle>
          <CardDescription className="mt-1 max-w-2xl">
            Totais do ano por categoria. Despesas com saúde e educação podem ser deduzidas na declaração: guarde os comprovantes.
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-2">
          <Select value={year} onValueChange={(value) => setYear(String(value))}>
            <SelectTrigger size="sm" aria-label="Ano do resumo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(years.length ? years : [currentYear]).map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!summary.incomeCents && !summary.expenseCents}>
            <Download data-icon="inline-start" />
            CSV do ano
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {summary.incomeCents || summary.expenseCents ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Receitas no ano", summary.incomeCents],
                ["Despesas no ano", summary.expenseCents],
                ["Saúde e educação", summary.deductibleCents],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-mono text-xl font-semibold">{brl(Number(value))}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <CategoryList title="Receitas por categoria" items={summary.incomeByCategory} />
              <CategoryList title="Despesas por categoria" items={summary.expenseByCategory} />
            </div>
            <details className="rounded-lg border p-3" open={summary.deductible.length > 0 && summary.deductible.length <= 8}>
              <summary className="cursor-pointer text-sm font-medium">
                Despesas dedutíveis ({summary.deductible.length})
              </summary>
              {summary.deductible.length ? (
                <ul className="mt-3 flex max-h-80 flex-col gap-1 overflow-y-auto border-t pt-3 text-sm">
                  {summary.deductible.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {formatDate(item.date)} · {item.description}
                        <span className="text-muted-foreground"> · {item.categoryName}</span>
                      </span>
                      <span className="shrink-0 font-mono">{brl(item.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhuma despesa nas categorias Saúde ou Educação em {year}. Para entrarem aqui, lance consultas, exames, planos, escola e faculdade nessas categorias.
                </p>
              )}
            </details>
            <p className="text-xs text-muted-foreground">
              Saúde não tem limite de dedução; educação tem um limite anual por pessoa. Confira as regras do ano na Receita Federal. Conteúdo informativo, não substitui um contador.
            </p>
          </>
        ) : (
          <Empty text={`Nenhum lançamento em ${year}.`} />
        )}
      </CardContent>
    </Card>
  );
}
