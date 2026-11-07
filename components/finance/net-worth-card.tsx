"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { getNetWorthHistory } from "@/lib/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Account, Empty, Holding, Tx, brl, isAllMoneyHidden } from "@/components/finance/shared";

const config = { patrimonio: { label: "Patrimônio", color: "var(--chart-1)" } } satisfies ChartConfig;
const monthLabel = (month: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", options).replace(".", "");
const compact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const signed = (cents: number) => `${cents >= 0 ? "+" : "−"}${brl(Math.abs(cents))}`;

/** Patrimônio no fim de cada mês: uma série só, então o título nomeia a linha e não há legenda. */
export function NetWorthCard({ accounts, transactions, holdings, currentDate }: {
  accounts: Account[];
  transactions: Tx[];
  holdings: Holding[];
  currentDate: string;
}) {
  const history = useMemo(
    () => getNetWorthHistory(accounts, transactions, holdings, currentDate),
    [accounts, transactions, holdings, currentDate],
  );
  const data = history.map((point) => ({
    month: monthLabel(point.month, { month: "short" }),
    label: monthLabel(point.month, { month: "long", year: "numeric" }),
    patrimonio: point.valueCents / 100,
  }));
  const current = history.at(-1)?.valueCents ?? 0;
  const previous = history.at(-2)?.valueCents;
  const first = history[0]?.valueCents ?? 0;
  const hidden = isAllMoneyHidden();
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Evolução do patrimônio</CardTitle>
          <CardDescription className="mt-1 max-w-xl">
            Saldo das contas, menos a dívida dos cartões, mais os investimentos pelo valor aplicado, no fim de cada mês.
          </CardDescription>
        </div>
        <div className="sm:text-right">
          <p className="font-mono text-2xl font-semibold tracking-tight">{brl(current)}</p>
          {previous !== undefined && (
            <p className="mt-1 text-xs text-muted-foreground">
              {signed(current - previous)} no mês
              {history.length > 2 && ` · ${signed(current - first)} em ${history.length - 1} meses`}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {history.length >= 2 ? (
          <ChartContainer config={config} className="h-64 w-full">
            <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
              <defs>
                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-patrimonio)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-patrimonio)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                hide={hidden}
                width={72}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => compact.format(value)}
              />
              {!hidden && (
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.label}
                      formatter={(value) => (
                        <span className="font-mono font-semibold tabular-nums text-foreground">
                          {brl(Math.round(Number(value) * 100))}
                        </span>
                      )}
                    />
                  }
                />
              )}
              <Area dataKey="patrimonio" type="monotone" stroke="var(--color-patrimonio)" strokeWidth={2} fill="url(#netWorthGradient)" />
            </AreaChart>
          </ChartContainer>
        ) : (
          <Empty text="O gráfico aparece a partir do segundo mês com lançamentos." />
        )}
      </CardContent>
    </Card>
  );
}
