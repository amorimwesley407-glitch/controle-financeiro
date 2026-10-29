"use client";

import { useState } from "react";
import { getCategoryComparison, getMonthlyForecast } from "@/lib/finance";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Calculator, Minus, ReceiptText, Scale, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Empty, Metric, Tx, brl, chartConfig } from "@/components/finance/shared";

export function ReportsView({
  income,
  expense,
  savings,
  flow,
  byCategory,
  transactions,
  currentDate,
}: {
  income: number;
  expense: number;
  savings: number;
  flow: { month: string; receitas: number; despesas: number; saldo: number }[];
  byCategory: { name: string; value: number; fill: string }[];
  transactions: Tx[];
  currentDate: string;
}) {
  const activeMonths = flow.filter((item) => item.receitas || item.despesas);
  const averageExpense = activeMonths.length
    ? expense / activeMonths.length
    : 0;
  const current = flow.at(-1);
  const previous = flow.at(-2);
  const expenseTrend = previous?.despesas
    ? Math.round(
        (((current?.despesas ?? 0) - previous.despesas) / previous.despesas) *
          100,
      )
    : 0;
  const health = Math.max(
    0,
    Math.min(
      100,
      income === 0
        ? 0
        : Math.round(50 + savings * 1.5 - (expense > income ? 25 : 0)),
    ),
  );
  const ranked = [...byCategory].sort((a, b) => b.value - a.value);
  const categoryTotal = ranked.reduce((sum, item) => sum + item.value, 0);
  const largest = ranked[0];
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Saúde financeira"
          value={`${health}/100`}
          note={
            health >= 70
              ? "Situação saudável"
              : health >= 40
                ? "Há espaço para melhorar"
                : "Requer atenção"
          }
          icon={Target}
        />
        <Metric
          title="Média mensal de gastos"
          value={brl(averageExpense)}
          note={`${activeMonths.length} ${activeMonths.length === 1 ? "mês analisado" : "meses analisados"}`}
          icon={ArrowDownRight}
        />
        <Metric
          title="Variação mensal"
          value={`${expenseTrend > 0 ? "+" : ""}${expenseTrend}%`}
          note="Despesas versus mês anterior"
          icon={TrendingUp}
        />
        <Metric
          title="Maior categoria"
          value={largest?.name ?? "—"}
          note={
            largest ? brl(largest.value * 100) : "Sem despesas categorizadas"
          }
          icon={ReceiptText}
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Receitas versus despesas</CardTitle>
            <CardDescription>
              Comparativo dos últimos seis meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeMonths.length ? (
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <BarChart data={flow} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="receitas"
                    fill="var(--color-receitas)"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="despesas"
                    fill="var(--color-despesas)"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <Empty text="Adicione lançamentos para gerar o comparativo mensal." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ranking de despesas</CardTitle>
            <CardDescription>Participação de cada categoria</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ranked.length ? (
              ranked.slice(0, 6).map((item, index) => {
                const percentage = categoryTotal
                  ? Math.round((item.value / categoryTotal) * 100)
                  : 0;
                return (
                  <div key={item.name} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">
                        <span className="mr-2 font-mono text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item.name}
                      </span>
                      <span className="font-mono font-medium">
                        {percentage}%
                      </span>
                    </div>
                    <Progress value={percentage} />
                    <p className="text-right text-xs text-muted-foreground">
                      {brl(item.value * 100)}
                    </p>
                  </div>
                );
              })
            ) : (
              <Empty text="Categorize suas despesas para montar o ranking." />
            )}
          </CardContent>
        </Card>
      </section>
      <CategoryComparisonCard transactions={transactions} currentDate={currentDate} />
      <ForecastCard transactions={transactions} currentDate={currentDate} />
      <Card>
        <CardHeader>
          <CardTitle>Resumo inteligente</CardTitle>
          <CardDescription>Leitura rápida dos seus indicadores</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <ReportInsight
            title="Capacidade de poupança"
            text={
              income === 0
                ? "Cadastre receitas para calcular sua taxa de economia."
                : savings >= 20
                  ? `Você preservou ${savings}% da renda, acima da referência de 20%.`
                  : `Sua taxa de economia é ${savings}%. Tente avançar gradualmente até 20%.`
            }
          />
          <ReportInsight
            title="Tendência de gastos"
            text={
              expenseTrend > 0
                ? `Os gastos cresceram ${expenseTrend}% em relação ao mês anterior.`
                : expenseTrend < 0
                  ? `Os gastos caíram ${Math.abs(expenseTrend)}% em relação ao mês anterior.`
                  : "Seus gastos estão estáveis ou ainda não há histórico suficiente."
            }
          />
          <ReportInsight
            title="Concentração"
            text={
              largest && categoryTotal
                ? `${largest.name} representa ${Math.round((largest.value / categoryTotal) * 100)}% das despesas categorizadas.`
                : "Ainda não há dados suficientes por categoria."
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

const monthName = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

function Difference({ value, percentage }: { value: number; percentage: number | null }) {
  if (!value)
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Minus className="size-3.5" /> igual
      </span>
    );
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`flex items-center gap-1 font-mono ${value > 0 ? "text-rose-400" : "text-emerald-400"}`}
    >
      <Icon className="size-3.5" />
      {value > 0 ? "+" : "−"}
      {brl(Math.abs(value))}
      {percentage !== null && (
        <span className="text-xs opacity-80">
          ({percentage > 0 ? "+" : ""}
          {percentage}%)
        </span>
      )}
    </span>
  );
}

export function CategoryComparisonCard({
  transactions,
  currentDate,
}: {
  transactions: Tx[];
  currentDate: string;
}) {
  const currentMonth = currentDate.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const { previousMonth, untilDay, rows, totalCurrent, totalPrevious } =
    getCategoryComparison(transactions, selectedMonth, currentDate);
  const totalDifference = totalCurrent - totalPrevious;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Comparativo com o mês anterior</CardTitle>
          <CardDescription>
            Despesas de {monthName(selectedMonth)} versus {monthName(previousMonth)}
            {untilDay ? `, até o dia ${untilDay} nos dois meses` : ""}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={selectedMonth}
            max={currentMonth}
            onChange={(event) => setSelectedMonth(event.target.value || currentMonth)}
            aria-label="Mês do comparativo"
            className="h-10 w-[150px]"
          />
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground sm:flex">
            <Scale className="size-5" />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-muted/35 p-3 text-sm">
              <span>
                Total: <span className="font-mono font-semibold">{brl(totalCurrent)}</span>
                <span className="text-muted-foreground"> (antes {brl(totalPrevious)})</span>
              </span>
              <Difference
                value={totalDifference}
                percentage={totalPrevious ? Math.round((totalDifference / totalPrevious) * 100) : null}
              />
            </div>
            <div className="flex flex-col divide-y">
              {rows.slice(0, 8).map((row) => (
                <div
                  key={row.name}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {brl(row.current)} · antes {brl(row.previous)}
                    </p>
                  </div>
                  {row.previous ? (
                    <Difference value={row.difference} percentage={row.percentage} />
                  ) : (
                    <span className="text-xs text-rose-400">nova este mês</span>
                  )}
                </div>
              ))}
            </div>
            {rows.length > 8 && (
              <p className="text-xs text-muted-foreground">
                Mostrando as 8 categorias que mais mudaram de {rows.length}.
              </p>
            )}
          </div>
        ) : (
          <Empty text="Não há despesas neste mês nem no anterior para comparar." />
        )}
      </CardContent>
    </Card>
  );
}

export function ForecastCard({
  transactions,
  currentDate,
}: {
  transactions: Tx[];
  currentDate: string;
}) {
  const currentMonth = currentDate.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const {
    isCurrentMonth,
    isFutureMonth,
    monthTransactions,
    futureTransactions,
    pendingIncome,
    pendingExpense,
    projectedBalance,
  } = getMonthlyForecast(transactions, selectedMonth, currentDate);
  return (
    <Card className="border-cyan-400/15 bg-gradient-to-br from-card to-cyan-500/[.045]">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Previsão mensal</CardTitle>
          <CardDescription>
            {isCurrentMonth
              ? "Saldo realizado mais lançamentos que ainda vão vencer"
              : isFutureMonth
                ? "Todos os lançamentos agendados para este mês"
                : "Resultado registrado no mês selecionado"}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={selectedMonth}
            min={transactions.at(-1)?.date.slice(0, 7)}
            onChange={(event) => setSelectedMonth(event.target.value || currentMonth)}
            aria-label="Mês da previsão"
            className="h-10 w-[150px]"
          />
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 sm:flex">
            <Calculator className="size-5" />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-semibold">{brl(projectedBalance)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">A receber</p>
            <p className="mt-1 font-mono font-semibold text-cyan-400">{brl(pendingIncome)}</p>
          </div>
          <div className="rounded-xl border bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">A pagar</p>
            <p className="mt-1 font-mono font-semibold">{brl(pendingExpense)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {futureTransactions.length
            ? `${futureTransactions.length} lançamento${futureTransactions.length === 1 ? "" : "s"} futuro${futureTransactions.length === 1 ? "" : "s"} considerado${futureTransactions.length === 1 ? "" : "s"}.`
            : isCurrentMonth
              ? "Não há lançamentos agendados depois de hoje neste mês. Selecione o próximo mês para consultar os recorrentes."
              : monthTransactions.length
                ? `${monthTransactions.length} lançamento${monthTransactions.length === 1 ? "" : "s"} considerado${monthTransactions.length === 1 ? "" : "s"}.`
                : "Nenhum lançamento cadastrado para o mês selecionado."}
        </p>
      </CardContent>
    </Card>
  );
}

export function ReportInsight({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-muted/35 p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
