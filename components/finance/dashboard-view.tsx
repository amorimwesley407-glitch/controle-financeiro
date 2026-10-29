"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Area, AreaChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Lightbulb, Target, TrendingUp, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Budget, Category, Empty, GoalType, Holding, Metric, Tx, brl, chartConfig } from "@/components/finance/shared";

export function DashboardView({
  income,
  expense,
  balance,
  savings,
  flow,
  byCategory,
  transactions,
  categories,
  goals,
  budgets,
  holdings,
  currentDate,
}: {
  income: number;
  expense: number;
  balance: number;
  savings: number;
  flow: { month: string; receitas: number; despesas: number; saldo: number }[];
  byCategory: { name: string; value: number; fill: string }[];
  transactions: Tx[];
  categories: Category[];
  goals: GoalType[];
  budgets: Budget[];
  holdings: Holding[];
  currentDate: string;
}) {
  const current = flow.at(-1) ?? {
    receitas: 0,
    despesas: 0,
    saldo: 0,
    month: "",
  };
  const previous = flow.at(-2);
  const trend = previous?.saldo
    ? Math.round(
        ((current.saldo - previous.saldo) / Math.abs(previous.saldo)) * 100,
      )
    : 0;
  const health = Math.max(
    0,
    Math.min(
      100,
      income ? Math.round(55 + savings * 1.4 - (expense > income ? 25 : 0)) : 0,
    ),
  );
  const invested = holdings.reduce(
    (sum, item) => sum + Number(item.quantity) * item.averageCostCents,
    0,
  );
  const ranked = [...byCategory].sort((a, b) => b.value - a.value);
  const categoryTotal = ranked.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="relative overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg xl:col-span-2">
          <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary-foreground/10" />
          <div className="pointer-events-none absolute -bottom-24 right-32 size-52 rounded-full bg-background/10" />
          <CardContent className="relative p-6 md:p-8">
            <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm text-primary-foreground/70">
                  Seu saldo consolidado
                </p>
                <p className="mt-2 font-mono text-4xl font-semibold tracking-tight md:text-5xl">
                  {brl(balance)}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs">
                  <TrendingUp className="size-3.5" />
                  {trend > 0 ? "+" : ""}
                  {trend}% no fluxo mensal
                </div>
              </div>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/15">
                <WalletCards className="size-6" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-primary-foreground/15 pt-5">
              <div>
                <p className="text-xs text-primary-foreground/65">
                  Entradas no mês
                </p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {brl(current.receitas * 100)}
                </p>
              </div>
              <div>
                <p className="text-xs text-primary-foreground/65">
                  Saídas no mês
                </p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {brl(current.despesas * 100)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>Saúde financeira</CardDescription>
                <CardTitle className="mt-1 text-3xl">
                  {health}
                  <span className="text-base font-normal text-muted-foreground">
                    /100
                  </span>
                </CardTitle>
              </div>
              <div
                className="relative flex size-16 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(var(--primary) ${health * 3.6}deg,var(--muted) 0)`,
                }}
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-card">
                  <Target className="size-5 text-primary" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={health} />
            <p className="mt-3 text-sm text-muted-foreground">
              {health >= 70
                ? "Bom equilíbrio entre renda e despesas."
                : health >= 40
                  ? "Revise gastos para ampliar sua reserva."
                  : "Seu caixa precisa de atenção prioritária."}
            </p>
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Receitas acumuladas"
          value={brl(income)}
          note="Todas as entradas registradas"
          icon={ArrowUpRight}
        />
        <Metric
          title="Despesas acumuladas"
          value={brl(expense)}
          note="Todos os gastos registrados"
          icon={ArrowDownRight}
        />
        <Metric
          title="Patrimônio investido"
          value={brl(invested)}
          note={`${holdings.length} ${holdings.length === 1 ? "ativo" : "ativos"} na carteira`}
          icon={TrendingUp}
        />
        <Metric
          title="Taxa de economia"
          value={`${savings}%`}
          note={
            savings >= 20
              ? "Meta saudável alcançada"
              : "Referência sugerida: 20%"
          }
          icon={Target}
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Evolução do caixa</CardTitle>
              <CardDescription>
                Receitas e despesas nos últimos seis meses
              </CardDescription>
            </div>
            <Badge variant="secondary">6 meses</Badge>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-80 w-full">
              <AreaChart data={flow}>
                <defs>
                  <linearGradient
                    id="incomeGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-receitas)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-receitas)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="expenseGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-despesas)"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-despesas)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="receitas"
                  type="monotone"
                  stroke="var(--color-receitas)"
                  strokeWidth={2}
                  fill="url(#incomeGradient)"
                />
                <Area
                  dataKey="despesas"
                  type="monotone"
                  stroke="var(--color-despesas)"
                  strokeWidth={2}
                  fill="url(#expenseGradient)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Onde você mais gasta</CardTitle>
            <CardDescription>Participação por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            {ranked.length ? (
              <>
                <ChartContainer config={chartConfig} className="h-44">
                  <PieChart>
                    <Pie
                      data={ranked}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                    />
                    <ChartTooltip
                      cursor={false}
                      offset={24}
                      content={
                        <ChartTooltipContent
                          hideLabel
                          hideIndicator
                          className="min-w-48"
                          formatter={(value, name, item) => (
                            <div className="flex w-full items-center justify-between gap-5">
                              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.payload?.fill }} />
                                <span className="truncate">{String(name)}</span>
                              </span>
                              <span className="shrink-0 font-mono font-semibold tabular-nums text-foreground">
                                {Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                  </PieChart>
                </ChartContainer>
                <div className="mt-2 flex flex-col gap-3">
                  {ranked.slice(0, 3).map((item, index) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: item.fill }}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                      <span className="font-mono text-xs font-medium">
                        {Math.round((item.value / categoryTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Empty text="Categorize despesas para visualizar seus gastos." />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function Insights({
  savings,
  expense,
  income,
}: {
  savings: number;
  expense: number;
  income: number;
}) {
  const tips =
    income === 0
      ? ["Registre suas receitas para calcular sua capacidade de poupança."]
      : savings < 10
        ? [
            "Sua taxa de economia está abaixo de 10%. Revise gastos recorrentes antes de investir.",
          ]
        : [
            "Você está poupando bem. Forme uma reserva de 6 meses antes de buscar mais risco.",
          ];
  if (expense > income)
    tips.push(
      "As despesas superaram as receitas. Priorize o equilíbrio do caixa.",
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-5" />
          Insights para você
        </CardTitle>
        <CardDescription>Orientações educativas</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tips.map((t, i) => (
          <div
            key={t}
            className="flex gap-3 rounded-xl bg-muted p-3 text-sm leading-relaxed"
          >
            <span className="font-mono font-semibold">0{i + 1}</span>
            <p>{t}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Conteúdo educativo; não constitui recomendação de investimento.
        </p>
      </CardContent>
    </Card>
  );
}
