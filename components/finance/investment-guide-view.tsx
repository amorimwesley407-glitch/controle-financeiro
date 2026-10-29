"use client";

import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoalType, Holding, Tx, brl } from "@/components/finance/shared";

export function InvestmentGuideView({
  transactions,
  goals,
  holdings,
  currentDate,
}: {
  transactions: Tx[];
  goals: GoalType[];
  holdings: Holding[];
  currentDate: string;
}) {
  const currentMonth = currentDate.slice(0, 7);
  const monthTransactions = transactions.filter(
    (transaction) =>
      transaction.date.slice(0, 7) === currentMonth &&
      transaction.date <= currentDate,
  );
  const monthIncome = monthTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const monthExpense = monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const available = Math.max(0, monthIncome - monthExpense);
  const invested = holdings.reduce(
    (sum, holding) => sum + Number(holding.quantity) * holding.averageCostCents,
    0,
  );
  const emergencyGoal = goals.find((goal) =>
    goal.name.toLocaleLowerCase("pt-BR").includes("emerg"),
  );
  const reserveProgress = emergencyGoal?.targetCents
    ? Math.min(100, Math.round((emergencyGoal.currentCents / emergencyGoal.targetCents) * 100))
    : 0;
  const buildingReserve = reserveProgress < 100;
  const allocation = buildingReserve
    ? [
        { label: "Reserva de emergência", percent: 80, detail: "Tesouro Selic ou CDB com liquidez diária" },
        { label: "Objetivos de curto prazo", percent: 20, detail: "Renda fixa compatível com o prazo" },
      ]
    : [
        { label: "Renda fixa", percent: 40, detail: "Proteção, liquidez e objetivos previsíveis" },
        { label: "ETFs de ações", percent: 30, detail: "Diversificação para o longo prazo" },
        { label: "Fundos imobiliários", percent: 15, detail: "Exposição ao mercado imobiliário" },
        { label: "Exterior", percent: 10, detail: "Diversificação geográfica e cambial" },
        { label: "Criptoativos", percent: 5, detail: "Parcela pequena e de risco elevado" },
      ];
  const alternatives = [
    {
      name: "Tesouro Selic / CDB diário",
      returnLabel: "Próximo da Selic ou do CDI",
      risk: "Baixo",
      liquidity: "Alta",
      fit: "Reserva e curto prazo",
    },
    {
      name: "CDB, LCI e LCA de prazo",
      returnLabel: "Percentual do CDI ou taxa prefixada",
      risk: "Baixo a médio",
      liquidity: "No vencimento",
      fit: "Metas com data definida",
    },
    {
      name: "Tesouro IPCA+",
      returnLabel: "Inflação + taxa contratada",
      risk: "Médio antes do vencimento",
      liquidity: "Diária, com oscilação",
      fit: "Objetivos de longo prazo",
    },
    {
      name: "ETFs de ações",
      returnLabel: "Varia conforme o mercado",
      risk: "Alto",
      liquidity: "Pregão da bolsa",
      fit: "Patrimônio no longo prazo",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden border-cyan-400/20 bg-gradient-to-br from-card via-card to-cyan-500/[.04]">
        <CardContent className="p-5 md:p-7">
          <div className="flex flex-col justify-between gap-5 border-b pb-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-muted-foreground">Você pode investir neste mês</p>
              <p className="mt-1 font-mono text-4xl font-semibold text-cyan-400">{brl(available)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Esse é o dinheiro que sobrou das receitas e despesas já realizadas.</p>
            </div>
            <div className="rounded-xl border bg-background/40 px-4 py-3 text-sm">
              <p className="font-medium">Seu objetivo agora</p>
              <p className="mt-1 text-muted-foreground">
                {buildingReserve ? "Completar a reserva de emergência" : "Diversificar seus investimentos"}
              </p>
            </div>
          </div>

          <div className="pt-6">
            <h2 className="text-lg font-semibold">Faça assim</h2>
            <p className="mt-1 text-sm text-muted-foreground">Divida o valor disponível desta forma:</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {allocation.map((item, index) => (
                <div key={item.label} className="flex gap-4 rounded-2xl border bg-background/35 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 font-mono font-semibold text-cyan-400">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    <p className="mt-3 font-mono text-2xl font-semibold">{brl(Math.round(available * item.percent / 100))}</p>
                    <p className="mt-1 text-xs text-cyan-400">{item.percent}% do valor disponível</p>
                  </div>
                </div>
              ))}
            </div>
            {available === 0 && (
              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-300">
                Ainda não sobrou dinheiro neste mês. Primeiro organize as contas e evite investir valores comprometidos.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onde colocar o dinheiro?</CardTitle>
          <CardDescription>
            {buildingReserve
              ? "Para a sua fase atual, escolha uma opção simples, segura e que permita retirar o dinheiro rapidamente."
              : "Com a reserva pronta, estas são as opções para cada objetivo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(buildingReserve ? alternatives.slice(0, 2) : alternatives).map((item, index) => (
            <article key={item.name} className={`rounded-2xl border p-4 ${index === 0 ? "border-cyan-400/30 bg-cyan-400/[.04]" : "bg-background/30"}`}>
              {index === 0 && <Badge className="mb-3">Mais simples para começar</Badge>}
              <h3 className="text-sm font-semibold">{item.name}</h3>
              <p className="mt-2 text-xs text-muted-foreground">{item.fit}</p>
              <div className="mt-4 space-y-2 border-t pt-3 text-xs">
                <p><span className="text-muted-foreground">Como rende: </span>{item.returnLabel}</p>
                <p><span className="text-muted-foreground">Quando sacar: </span>{item.liquidity}</p>
                <p><span className="text-muted-foreground">Risco: </span>{item.risk}</p>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border p-4"><span className="text-muted-foreground">Sua reserva: </span><strong>{reserveProgress}% concluída</strong></div>
        <div className="rounded-xl border p-4"><span className="text-muted-foreground">Você já investiu: </span><strong>{brl(invested)}</strong></div>
      </div>

      <Card className="border-amber-400/15">
        <CardContent className="flex gap-3 p-4 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <p>
            Conteúdo educativo e estimativo, não uma recomendação individual. Rentabilidade passada não garante retorno futuro; confira taxas, impostos, cobertura do FGC, prazo e risco antes de investir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
