"use client";

import { useEffect, useState, useTransition } from "react";
import useSWR from "swr";
import { getHoldingPerformance } from "@/lib/finance";
import Image from "next/image";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { Bitcoin, CircleDollarSign, Pencil, RotateCcw, Trash2, TrendingUp } from "lucide-react";
import { deleteHolding, updateHolding } from "@/app/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Category, Empty, Field, HistoricalPoint, HistoryRange, Holding, Quote, StockQuote, brl, isFixedIncomeType } from "@/components/finance/shared";
import { FormDialog } from "@/components/finance/form-dialog";

export function EditHoldingDialog({ holding }: { holding: Holding }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [assetType, setAssetType] = useState(holding.assetType);
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        await updateHolding(holding.id, form);
        setOpen(false);
        toast.success("Ativo atualizado.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o ativo.",
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
            aria-label={`Editar ${holding.symbol}`}
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar ativo</DialogTitle>
          <DialogDescription>
            Atualize os dados deste investimento.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Símbolo">
              <Input name="symbol" defaultValue={holding.symbol} required />
            </Field>
            <Field label="Tipo">
              <Select
                name="assetType"
                value={assetType}
                onValueChange={(value) => setAssetType(String(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="stock">Ação</SelectItem>
                    <SelectItem value="crypto">Cripto</SelectItem>
                    <SelectItem value="fund">Fundo</SelectItem>
                    <SelectItem value="cdb">CDB</SelectItem>
                    <SelectItem value="treasury">Tesouro Selic</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {isFixedIncomeType(assetType) ? (
            <>
              <input type="hidden" name="quantity" value="1" />
              <Field label="Valor aplicado">
                <Input
                  name="averageCost"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={(
                    (Number(holding.quantity) * holding.averageCostCents) /
                    100
                  ).toFixed(2)}
                  required
                />
              </Field>
              <Field label="Data da aplicação">
                <Input
                  name="applicationDate"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={holding.applicationDate ?? ""}
                  required
                />
              </Field>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantidade">
                <Input name="quantity" type="number" min="0.00000001" step="any" defaultValue={holding.quantity} required />
              </Field>
              <Field label="Preço médio">
                <Input name="averageCost" type="number" min="0.01" step="0.01" defaultValue={(holding.averageCostCents / 100).toFixed(2)} required />
              </Field>
            </div>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const fetchMarket = (url: string) =>
  fetch(url).then((response) => {
    if (!response.ok) throw new Error("Cotações indisponíveis");
    return response.json() as Promise<{ quotes: Quote[]; stockQuotes: StockQuote[] }>;
  });

export function InvestmentsView({
  holdings,
  categories,
}: {
  holdings: Holding[];
  categories: Category[];
}) {
  // Cotações vêm de APIs externas: buscadas só ao abrir esta aba, sem travar o carregamento do app.
  const { data: market, isLoading: marketLoading } = useSWR("/api/market", fetchMarket, {
    revalidateOnFocus: false,
  });
  const quotes = market?.quotes ?? [];
  const stockQuotes = market?.stockQuotes ?? [];
  const total = holdings.reduce(
    (s, h) => s + Number(h.quantity) * h.averageCostCents,
    0,
  );
  async function remove(holding: Holding) {
    if (!window.confirm(`Excluir ${holding.symbol} da carteira?`)) return;
    try {
      await deleteHolding(holding.id);
      toast.success("Ativo excluído.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o ativo.",
      );
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-3">
        {marketLoading ? <Skeleton className="h-64 w-full rounded-xl" /> : <StockMarket quotes={stockQuotes} />}
      </div>
      <Card className="xl:col-span-2">
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Minha carteira</CardTitle>
            <CardDescription>
              Patrimônio investido: {brl(total)}
            </CardDescription>
          </div>
          <FormDialog type="holding" categories={categories} quotes={quotes} />
        </CardHeader>
        <CardContent>
          {holdings.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {holdings.map((holding) => (
                <HoldingFlipCard
                  key={holding.id}
                  holding={holding}
                  stockQuote={stockQuotes.find(
                    (quote) => quote.symbol === holding.symbol,
                  )}
                  marketQuote={quotes.find(
                    (quote) =>
                      quote.symbol === holding.symbol ||
                      (holding.assetType === "treasury" && quote.symbol === "SELIC"),
                  )}
                  onRemove={() => void remove(holding)}
                />
              ))}
            </div>
          ) : (
            <Empty text="Adicione o primeiro ativo à sua carteira." />
          )}
        </CardContent>
      </Card>
      {marketLoading ? <Skeleton className="h-64 w-full rounded-xl" /> : <Quotes quotes={quotes} />}
    </div>
  );
}

export function HoldingFlipCard({
  holding,
  stockQuote,
  marketQuote,
  onRemove,
}: {
  holding: Holding;
  stockQuote?: StockQuote;
  marketQuote?: Quote;
  onRemove: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const quantity = Number(holding.quantity);
  const fixedIncome = isFixedIncomeType(holding.assetType);
  const currentPriceCents = fixedIncome
    ? null
    : stockQuote
    ? Math.round(stockQuote.price * 100)
    : marketQuote
      ? Math.round(marketQuote.value * 100)
      : null;
  const { invested, result, resultPercentage } = getHoldingPerformance(
    quantity,
    holding.averageCostCents,
    currentPriceCents,
  );
  const typeLabel =
    holding.assetType === "stock"
      ? "Ação"
      : holding.assetType === "crypto"
        ? "Cripto"
        : holding.assetType === "cdb"
          ? "CDB"
          : holding.assetType === "treasury"
            ? "Tesouro Selic"
            : "Fundo";
  return (
    <div
      className={`holding-flip-scene ${fixedIncome ? "h-72" : "h-64"}`}
    >
      <div className="holding-flip-card size-full" data-flipped={flipped}>
        <button
          type="button"
          className="holding-flip-face flex size-full flex-col rounded-2xl border bg-gradient-to-br from-card via-card to-cyan-500/[.045] p-5 text-left shadow-sm outline-none transition-colors hover:border-cyan-400/25 focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          onClick={() => setFlipped(true)}
          aria-label={`Ver detalhes de ${holding.symbol}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="outline" className="border-cyan-400/20 text-cyan-400">{typeLabel}</Badge>
              <div className="mt-3 flex items-center gap-3">
                {stockQuote ? (
                  <StockLogo quote={stockQuote} />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background/60 text-cyan-400">
                    {holding.assetType === "crypto" ? <Bitcoin className="size-5" /> : <span className="text-xs font-bold">{holding.symbol.slice(0, 2)}</span>}
                  </span>
                )}
                <p className="font-mono text-2xl font-semibold">{holding.symbol}</p>
              </div>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl border bg-background/50 text-cyan-400">
              <TrendingUp className="size-5" />
            </span>
          </div>
          <div className="mt-auto">
            <p className="text-xs text-muted-foreground">Valor investido</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{brl(invested)}</p>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>
                {holding.assetType === "crypto" && holding.symbol === "BTC"
                  ? `${quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} BTC · ${Math.round(quantity * 100_000_000).toLocaleString("pt-BR")} sats`
                  : isFixedIncomeType(holding.assetType)
                    ? "Renda fixa"
                    : `${quantity.toLocaleString("pt-BR")} unidades`}
              </span>
              <span className="text-cyan-400">Toque para virar →</span>
            </div>
          </div>
        </button>
        <div className="holding-flip-face holding-flip-back flex size-full flex-col rounded-2xl border border-violet-400/20 bg-gradient-to-br from-card via-card to-violet-500/[.055] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Detalhes da posição</p>
              <p className="mt-1 font-mono text-xl font-semibold">
                {fixedIncome ? typeLabel : holding.symbol}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setFlipped(false)} aria-label="Voltar para o resumo">
              <RotateCcw />
            </Button>
          </div>
          {fixedIncome ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border bg-background/35 p-3">
                  <p className="text-[11px] text-muted-foreground">Valor aplicado</p>
                  <p className="mt-1 font-mono font-semibold">{brl(invested)}</p>
                </div>
                <div className="rounded-xl border bg-background/35 p-3">
                  <p className="text-[11px] text-muted-foreground">Referência</p>
                  <p className="mt-1 font-mono font-semibold">
                    {holding.assetType === "treasury"
                      ? marketQuote
                        ? `Selic ${marketQuote.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a.`
                        : "Taxa Selic"
                      : "Taxa do CDB"}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border bg-background/35 p-3 text-xs leading-relaxed text-muted-foreground">
                {holding.applicationDate ? (
                  <span>
                    Aplicado em {new Date(`${holding.applicationDate}T12:00:00`).toLocaleDateString("pt-BR")}.
                    {holding.assetType === "treasury"
                      ? " A Selic exibida é uma referência anual; o saldo exato depende do preço do título, impostos e taxas."
                      : " Para calcular o rendimento, ainda é necessário informar a taxa contratada do CDB."}
                  </span>
                ) : (
                  <span>Edite este investimento e informe a data da aplicação.</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border bg-background/35 p-3">
                  <p className="text-[11px] text-muted-foreground">Preço médio</p>
                  <p className="mt-1 font-mono font-semibold">{brl(holding.averageCostCents)}</p>
                </div>
                <div className="rounded-xl border bg-background/35 p-3">
                  <p className="text-[11px] text-muted-foreground">Cotação atual</p>
                  <p className="mt-1 font-mono font-semibold">{currentPriceCents === null ? "Indisponível" : brl(currentPriceCents)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border bg-background/35 p-3 text-sm">
                <span className="text-muted-foreground">Resultado</span>
                <span className={`font-mono font-semibold ${result !== null && result < 0 ? "text-rose-400" : "text-cyan-400"}`}>
                  {result === null ? "—" : `${result >= 0 ? "+" : ""}${brl(result)} · ${resultPercentage?.toFixed(2)}%`}
                </span>
              </div>
            </>
          )}
          <div className="mt-auto flex justify-end gap-1 border-t pt-3">
            <EditHoldingDialog holding={holding} />
            <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${holding.symbol}`} onClick={onRemove}>
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StockMarket({ quotes }: { quotes: StockQuote[] }) {
  const [range, setRange] = useState<HistoryRange>("1mo");
  const [histories, setHistories] = useState<Record<string, HistoricalPoint[]>>({});
  const [loadedRange, setLoadedRange] = useState<HistoryRange | null>(null);
  const historyLoading = loadedRange !== range;
  useEffect(() => {
    if (!quotes.length) return;
    const controller = new AbortController();
    fetch(`/api/stocks/history?symbols=${quotes.map((quote) => quote.symbol).join(",")}&range=${range}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Histórico indisponível")))
      .then((data: { histories?: Record<string, HistoricalPoint[]> }) => { setHistories(data.histories ?? {}); setLoadedRange(range); })
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") { setHistories({}); setLoadedRange(range); } });
    return () => controller.abort();
  }, [quotes, range]);
  return (
    <Card className="overflow-visible">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Principais ações da B3</CardTitle>
            <CardDescription>
              Cotações com atualização automática a cada cinco minutos
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-muted/20 p-1" aria-label="Período do histórico">
              {([['7d', '7D'], ['1mo', '1M'], ['6mo', '6M'], ['1y', '1A']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setRange(value)} className={`rounded-md px-2.5 py-1 text-xs transition-colors ${range === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {label}
                </button>
              ))}
            </div>
            <Badge variant="outline">Mercado brasileiro</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {quotes.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {quotes.map((quote, index) => (
              <StockMetricCard
                key={quote.symbol}
                quote={quote}
                history={loadedRange === range ? histories[quote.symbol] ?? [] : []}
                range={range}
                loading={historyLoading}
                alignPanel={index >= Math.ceil(quotes.length / 2) ? "left" : "right"}
              />
            ))}
          </div>
        ) : (
          <Empty text="As cotações da B3 estão temporariamente indisponíveis. Tente novamente em alguns minutos." />
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Fonte: brapi.dev. Cotações podem apresentar atraso e têm caráter
          informativo.
        </p>
      </CardContent>
    </Card>
  );
}

export function StockMetricCard({
  quote,
  history,
  range,
  loading,
  alignPanel,
}: {
  quote: StockQuote;
  history: HistoricalPoint[];
  range: HistoryRange;
  loading: boolean;
  alignPanel: "left" | "right";
}) {
  const divisor = 1 + quote.change / 100;
  const previousPrice = divisor > 0 ? quote.price / divisor : quote.price;
  const chartData = history.length > 1
    ? history.map((point) => ({ label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(point.date * 1000)), value: point.value }))
    : [{ label: "Anterior", value: previousPrice }, { label: "Atual", value: quote.price }];
  const firstPrice = chartData[0]?.value ?? previousPrice;
  const lastPrice = chartData.at(-1)?.value ?? quote.price;
  const periodChange = firstPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : quote.change;
  const positive = periodChange >= 0;
  const rangeLabel: Record<HistoryRange, string> = { '7d': '7 dias', '1mo': '1 mês', '6mo': '6 meses', '1y': '1 ano' };
  const gradientId = `stock-gradient-${quote.symbol}`;
  return (
    <div className="group/stock relative min-h-36 rounded-xl border bg-card p-4 transition-all duration-300 hover:z-40 hover:border-cyan-400/25 hover:shadow-[0_12px_35px_rgba(0,0,0,.18)]">
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <StockLogo quote={quote} />
          <div className="min-w-0">
            <p className="font-semibold">{quote.symbol}</p>
            <p className="truncate text-xs text-muted-foreground" title={quote.name}>{quote.name}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${positive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
          {positive ? "+" : ""}{periodChange.toFixed(2)}%
        </span>
      </div>
      <p className="relative z-10 mt-5 font-mono text-xl font-semibold transition-transform duration-300 group-hover/stock:-translate-y-1">
        {quote.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 translate-y-3 opacity-0 transition-all duration-300 group-hover/stock:translate-y-0 group-hover/stock:opacity-100 motion-reduce:transition-none max-sm:translate-y-0 max-sm:opacity-50">
        <ChartContainer
          config={{ value: { label: "Preço", color: positive ? "var(--chart-1)" : "var(--destructive)" } }}
          className="size-full"
        >
          <AreaChart data={chartData} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={positive ? "var(--chart-1)" : "var(--destructive)"} stopOpacity={0.32} />
                <stop offset="100%" stopColor={positive ? "var(--chart-1)" : "var(--destructive)"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Area type="monotone" dataKey="value" stroke={positive ? "var(--chart-1)" : "var(--destructive)"} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
      </div>
      <div className={`pointer-events-none absolute top-1/2 z-50 hidden w-[430px] -translate-y-1/2 scale-[.98] opacity-0 transition-all duration-300 group-hover/stock:scale-100 group-hover/stock:opacity-100 xl:block ${alignPanel === "right" ? "left-[calc(100%+.75rem)] -translate-x-3 group-hover/stock:translate-x-0" : "right-[calc(100%+.75rem)] translate-x-3 group-hover/stock:translate-x-0"}`}>
        <div className="overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#111315]/98 shadow-[0_24px_70px_rgba(0,0,0,.6)] backdrop-blur-xl">
          <div className="grid grid-cols-[150px_1fr]">
            <div className="flex min-h-56 flex-col border-r border-white/10 p-5">
              <div className="flex items-center gap-2">
                <StockLogo quote={quote} />
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-white">{quote.symbol}</p>
                  <p className="truncate text-[10px] text-zinc-500">{quote.name}</p>
                </div>
              </div>
              <p className="mt-8 font-mono text-3xl font-semibold tracking-tight text-white">
                {quote.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className={`mt-2 text-xs ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                {positive ? "↑" : "↓"} {Math.abs(periodChange).toFixed(2)}% em {rangeLabel[range]}
              </p>
              <p className="mt-auto text-[10px] uppercase tracking-[.18em] text-zinc-500">B3 · Brasil</p>
            </div>
            <div className="relative min-h-56 overflow-hidden p-4">
              <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,rgba(34,211,238,.35)_1px,transparent_1px)] [background-size:13px_13px]" />
              <div className="relative flex items-center justify-between text-[11px]">
                <span className={positive ? "text-emerald-400" : "text-rose-400"}>{positive ? "+" : ""}{periodChange.toFixed(2)}%</span>
                <span className="text-zinc-500">{loading ? "Carregando histórico…" : rangeLabel[range]}</span>
              </div>
              <div className="relative mt-3 h-36">
                <ChartContainer config={{ value: { label: "Preço", color: positive ? "var(--chart-1)" : "var(--destructive)" } }} className="size-full">
                  <AreaChart data={chartData} margin={{ top: 12, right: 8, bottom: 0, left: 8 }}>
                    <defs>
                      <linearGradient id={`${gradientId}-panel`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={positive ? "var(--chart-1)" : "var(--destructive)"} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={positive ? "var(--chart-1)" : "var(--destructive)"} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={["dataMin", "dataMax"]} hide />
                    <XAxis dataKey="label" hide />
                    <Area type="monotone" dataKey="value" stroke={positive ? "var(--chart-1)" : "var(--destructive)"} strokeWidth={2.5} fill={`url(#${gradientId}-panel)`} isAnimationActive />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-white/10 px-5 py-3 text-[10px] text-zinc-500">
            <span>Início <strong className="ml-1 font-mono text-zinc-300">{firstPrice.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong></span>
            <span className="text-center">Atual <strong className="ml-1 font-mono text-zinc-300">{lastPrice.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong></span>
            <span className="text-right">Fonte: brapi</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StockLogo({ quote }: { quote: StockQuote }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white shadow-sm">
      {quote.logoUrl && !failed ? (
        <Image
          src={quote.logoUrl}
          width={40}
          height={40}
          alt={`Logo ${quote.name}`}
          className="size-full object-contain p-1.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-xs font-bold text-zinc-700">
          {quote.symbol.slice(0, 2)}
        </span>
      )}
    </span>
  );
}

export function Quotes({ quotes }: { quotes: Quote[] }) {
  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle>Indicadores do mercado</CardTitle>
        <CardDescription>
          Dados públicos atualizados periodicamente
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {quotes.map((q) => (
          <MarketMetricRow key={q.symbol} quote={q} />
        ))}
      </CardContent>
    </Card>
  );
}

export function MarketMetricRow({ quote: q }: { quote: Quote }) {
  const positive = q.change >= 0;
  const neutral = q.kind === "rate";
  const divisor = 1 + q.change / 100;
  const previousValue = neutral || divisor <= 0 ? q.value : q.value / divisor;
  const color = neutral
    ? "var(--chart-3)"
    : positive
      ? "var(--chart-1)"
      : "var(--destructive)";
  const gradientId = `market-gradient-${q.symbol}`;
  return (
    <div className={`group/market relative min-h-16 rounded-xl border p-3 transition-all duration-300 hover:z-40 hover:border-cyan-400/25 hover:shadow-md ${neutral ? "border-primary/25 bg-primary/5" : ""}`}>
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${neutral ? "bg-primary/15 text-primary" : "bg-muted"}`}>
            {q.kind === "crypto" ? <Bitcoin className="size-4" /> : neutral ? <TrendingUp className="size-4" /> : <CircleDollarSign className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{q.name}</p>
            <p className="truncate text-xs text-muted-foreground">{neutral ? "Banco Central do Brasil" : q.symbol}</p>
          </div>
        </div>
        <div className="shrink-0 text-right transition-transform duration-300 group-hover/market:-translate-y-0.5">
          <p className="font-mono text-sm font-semibold">
            {neutral
              ? `${q.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
              : q.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className={`text-xs ${neutral ? "text-muted-foreground" : positive ? "text-primary" : "text-destructive"}`}>
            {neutral ? "Meta atual" : `${positive ? "+" : ""}${q.change.toFixed(2)}%`}
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 translate-y-2 opacity-0 transition-all duration-300 group-hover/market:translate-y-0 group-hover/market:opacity-70 motion-reduce:transition-none max-sm:translate-y-0 max-sm:opacity-25">
        <ChartContainer config={{ value: { label: "Valor", color } }} className="size-full">
          <AreaChart data={[{ value: previousValue }, { value: q.value }]} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
      </div>
      <div className="pointer-events-none absolute right-[calc(100%+.75rem)] top-1/2 z-50 hidden w-[430px] -translate-y-1/2 translate-x-3 scale-[.98] opacity-0 transition-all duration-300 group-hover/market:translate-x-0 group-hover/market:scale-100 group-hover/market:opacity-100 xl:block">
        <div className="overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#111315]/98 shadow-[0_24px_70px_rgba(0,0,0,.6)] backdrop-blur-xl">
          <div className="grid grid-cols-[150px_1fr]">
            <div className="flex min-h-56 flex-col border-r border-white/10 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {q.kind === "crypto" ? <Bitcoin className="size-4 text-cyan-400" /> : neutral ? <TrendingUp className="size-4 text-cyan-400" /> : <CircleDollarSign className="size-4 text-cyan-400" />}
                <span className="truncate">{q.name}</span>
              </div>
              <p className="mt-8 font-mono text-3xl font-semibold tracking-tight text-white">
                {neutral
                  ? `${q.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                  : q.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className={`mt-2 text-xs ${neutral ? "text-zinc-400" : positive ? "text-emerald-400" : "text-rose-400"}`}>
                {neutral ? "Meta anual atual" : `${positive ? "↑" : "↓"} ${Math.abs(q.change).toFixed(2)}% no período`}
              </p>
              <p className="mt-auto text-[10px] uppercase tracking-[.18em] text-zinc-500">{neutral ? "Banco Central" : q.symbol}</p>
            </div>
            <div className="relative min-h-56 overflow-hidden p-4">
              <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,rgba(34,211,238,.35)_1px,transparent_1px)] [background-size:13px_13px]" />
              <div className="relative flex items-center justify-between text-[11px]">
                <span className={neutral ? "text-zinc-400" : positive ? "text-emerald-400" : "text-rose-400"}>{neutral ? "Indicador vigente" : `${positive ? "+" : ""}${q.change.toFixed(2)}%`}</span>
                <span className="text-zinc-500">Comparativo atual</span>
              </div>
              <div className="relative mt-3 h-36">
                <ChartContainer config={{ value: { label: "Valor", color } }} className="size-full">
                  <AreaChart data={[{ label: "Anterior", value: previousValue }, { label: "Atual", value: q.value }]} margin={{ top: 12, right: 8, bottom: 0, left: 8 }}>
                    <defs>
                      <linearGradient id={`${gradientId}-panel`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={["dataMin", "dataMax"]} hide />
                    <XAxis dataKey="label" hide />
                    <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId}-panel)`} isAnimationActive />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-white/10 px-5 py-3 text-[10px] text-zinc-500">
            <span>Anterior <strong className="ml-1 font-mono text-zinc-300">{previousValue.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong></span>
            <span className="text-center">Atual <strong className="ml-1 font-mono text-zinc-300">{q.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong></span>
            <span className="text-right">Fonte pública</span>
          </div>
        </div>
      </div>
    </div>
  );
}
