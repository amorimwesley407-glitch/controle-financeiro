"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bitcoin,
  BriefcaseBusiness,
  BusFront,
  Calculator,
  Camera,
  CalendarDays,
  Car,
  ChartColumn,
  CircleDollarSign,
  CreditCard,
  Download,
  Dumbbell,
  FileSpreadsheet,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Palette,
  PawPrint,
  Pencil,
  Pill,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Scissors,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Target,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Tv,
  Upload,
  UserRound,
  Utensils,
  WalletCards,
  Wifi,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  addBudget,
  addCategory,
  addGoal,
  addHolding,
  addTransaction,
  deleteBudget,
  deleteCategory,
  deleteGoal,
  deleteHolding,
  deleteTransaction,
  importTransactions,
  updateBudget,
  updateCategory,
  updateGoal,
  updateHolding,
  updateTransaction,
  updateUserProfile,
} from "@/app/actions/finance";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { FinancialGoalsOrbit } from "@/components/financial-goals-orbit";
import { AnimatedCard } from "@/components/ui/animated-card";
import { AnimatedList } from "@/components/ui/animated-list";
import { LocationTag } from "@/components/ui/location-tag";
import { GoalsFeatureCard } from "@/components/goals-feature-card";

type Tx = {
  id: number;
  description: string;
  type: string;
  amountCents: number;
  date: string;
  categoryId: number | null;
  imagePath?: string | null;
  recurring?: boolean;
  categoryName?: string;
  categoryIcon?: string;
  categoryImage?: string | null;
};
type Category = {
  id: number;
  name: string;
  type: string;
  color: string;
  icon: string;
  imagePath?: string | null;
};
type GoalType = {
  id: number;
  name: string;
  targetCents: number;
  currentCents: number;
  deadline: string | null;
};
type Budget = { id: number; name: string; limitCents: number; month: string; categoryId: number | null };
type Holding = {
  id: number;
  symbol: string;
  assetType: string;
  quantity: string;
  averageCostCents: number;
  applicationDate?: string | null;
};
type Quote = {
  symbol: string;
  name: string;
  value: number;
  change: number;
  kind: string;
};
type StockQuote = {
  symbol: string;
  name: string;
  logoUrl?: string;
  price: number;
  change: number;
  updatedAt: string | null;
};
type HistoricalPoint = { date: number; value: number };
type HistoryRange = "7d" | "1mo" | "6mo" | "1y";
type Props = {
  currentDate: string;
  user: { name: string; email: string; image: string | null };
  transactions: Tx[];
  categories: Category[];
  goals: GoalType[];
  budgets: Budget[];
  holdings: Holding[];
  quotes: Quote[];
  stockQuotes: StockQuote[];
};
type View =
  | "dashboard"
  | "reports"
  | "tools"
  | "transactions"
  | "planning"
  | "investment"
  | "investments"
  | "categories"
  | "settings";
const brl = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    c / 100,
  );
function getBudgetAlerts(
  transactions: Tx[],
  budgets: Budget[],
  categories: Category[],
  currentDate: string,
) {
  const currentMonth = currentDate.slice(0, 7);
  const monthTransactions = transactions.filter((item) =>
    item.date.startsWith(currentMonth),
  );
  return budgets
    .filter((budget) => budget.month === currentMonth)
    .map((budget) => {
      const normalizedName = budget.name.trim().toLocaleLowerCase("pt-BR");
      const category = categories.find(
        (item) => budget.categoryId ? item.id === budget.categoryId : item.name.trim().toLocaleLowerCase("pt-BR") === normalizedName,
      );
      const spent = monthTransactions
        .filter(
          (item) =>
            item.type === "expense" &&
            item.date <= currentDate &&
            (category
              ? item.categoryId === category.id
              : (item.categoryName ?? "")
                  .trim()
                  .toLocaleLowerCase("pt-BR") === normalizedName),
        )
        .reduce((sum, item) => sum + item.amountCents, 0);
      return {
        ...budget,
        spent,
        percentage: Math.round((spent / budget.limitCents) * 100),
      };
    })
    .filter((budget) => budget.percentage >= 70)
    .sort((a, b) => b.percentage - a.percentage);
}
const chartConfig = {
  receitas: { label: "Receitas", color: "var(--chart-1)" },
  despesas: { label: "Despesas", color: "var(--chart-2)" },
  saldo: { label: "Saldo", color: "var(--chart-3)" },
} satisfies ChartConfig;
const categoryIcons = {
  wallet: WalletCards,
  food: Utensils,
  home: House,
  transport: Car,
  shopping: ShoppingBag,
  health: HeartPulse,
  education: GraduationCap,
  leisure: Gamepad2,
  work: BriefcaseBusiness,
  gift: Gift,
  barber: Scissors,
  pet: PawPrint,
  internet: Wifi,
  gym: Dumbbell,
  streaming: Tv,
  transitBenefit: BusFront,
  supplements: Pill,
  bill: CreditCard,
  cardInsurance: ShieldCheck,
} as const;
const transactionIconStyles = {
  wallet: "border-blue-400/20 bg-blue-500/15 text-blue-400",
  food: "border-orange-400/20 bg-orange-500/15 text-orange-400",
  home: "border-cyan-400/20 bg-cyan-500/15 text-cyan-400",
  transport: "border-sky-400/20 bg-sky-500/15 text-sky-400",
  shopping: "border-fuchsia-400/20 bg-fuchsia-500/15 text-fuchsia-400",
  health: "border-rose-400/20 bg-rose-500/15 text-rose-400",
  education: "border-violet-400/20 bg-violet-500/15 text-violet-400",
  leisure: "border-purple-400/20 bg-purple-500/15 text-purple-400",
  work: "border-emerald-400/20 bg-emerald-500/15 text-emerald-400",
  gift: "border-pink-400/20 bg-pink-500/15 text-pink-400",
  barber: "border-cyan-400/20 bg-cyan-500/15 text-cyan-400",
  pet: "border-amber-400/20 bg-amber-500/15 text-amber-400",
  internet: "border-blue-400/20 bg-blue-500/15 text-blue-400",
  gym: "border-lime-400/20 bg-lime-500/15 text-lime-400",
  streaming: "border-purple-400/20 bg-purple-500/15 text-purple-400",
  transitBenefit: "border-emerald-400/20 bg-emerald-500/15 text-emerald-400",
  supplements: "border-orange-400/20 bg-orange-500/15 text-orange-400",
  bill: "border-rose-400/20 bg-rose-500/15 text-rose-400",
  cardInsurance: "border-teal-400/20 bg-teal-500/15 text-teal-400",
  default: "border-white/10 bg-white/5 text-zinc-300",
} as const;
const categoryIconOptions = [
  ["wallet", "Carteira"],
  ["food", "Alimentação"],
  ["home", "Moradia"],
  ["transport", "Transporte"],
  ["shopping", "Compras"],
  ["health", "Saúde"],
  ["education", "Educação"],
  ["leisure", "Lazer"],
  ["work", "Trabalho"],
  ["gift", "Presentes"],
  ["barber", "Barbeiro"],
  ["pet", "Pet"],
  ["internet", "Internet"],
  ["gym", "Academia"],
  ["streaming", "Streaming"],
  ["transitBenefit", "Vale-transporte"],
  ["supplements", "Suplementos"],
  ["bill", "Fatura"],
  ["cardInsurance", "Seguro do cartão"],
] as const;
const streamingServices = [
  "Netflix",
  "Prime Video",
  "Disney+",
  "Max",
  "Globoplay",
  "Apple TV+",
  "Paramount+",
  "YouTube Premium",
  "Spotify",
  "Deezer",
  "Outro streaming",
] as const;
const streamingServiceImages: Partial<
  Record<(typeof streamingServices)[number], string>
> = {
  Netflix: "/brands/netflix.svg",
  "Prime Video": "/brands/prime-video.svg",
  "Disney+": "/brands/disney-plus.svg",
  Max: "/brands/max.svg",
  Globoplay: "/brands/globoplay.svg",
  "Apple TV+": "/brands/apple-tv-plus.svg",
  "Paramount+": "/brands/paramount-plus.svg",
  "YouTube Premium": "/brands/youtube-premium.svg",
  Spotify: "/brands/spotify.svg",
  Deezer: "/brands/deezer.svg",
};
function getStreamingServiceImage(description: string) {
  return streamingServiceImages[
    description as (typeof streamingServices)[number]
  ];
}
function isStreamingCategory(category?: Category) {
  return Boolean(
    category &&
      (category.icon === "streaming" ||
        category.name.trim().toLocaleLowerCase("pt-BR").includes("streaming")),
  );
}
const investmentOptions = {
  stock: [
    ["PETR4", "Petrobras PN"],
    ["VALE3", "Vale ON"],
    ["ITUB4", "Itaú Unibanco PN"],
    ["BBAS3", "Banco do Brasil ON"],
    ["MGLU3", "Magazine Luiza ON"],
    ["BBDC4", "Bradesco PN"],
    ["ABEV3", "Ambev ON"],
    ["WEGE3", "WEG ON"],
    ["B3SA3", "B3 ON"],
    ["ELET3", "Eletrobras ON"],
    ["RENT3", "Localiza ON"],
  ],
  crypto: [
    ["BTC", "Bitcoin"],
    ["ETH", "Ethereum"],
    ["SOL", "Solana"],
  ],
  fund: [
    ["HGLG11", "CSHG Logística"],
    ["KNRI11", "Kinea Renda Imobiliária"],
    ["MXRF11", "Maxi Renda"],
    ["XPML11", "XP Malls"],
  ],
  cdb: [["CDB", "Certificado de Depósito Bancário"]],
  treasury: [["TESOURO-SELIC", "Tesouro Selic"]],
} as const;
const isFixedIncomeType = (type: string) =>
  type === "cdb" || type === "treasury";
const repairImportedText = (text: string) => {
  if (!/[ÃÂâ]/.test(text)) return text;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from([...text].map((character) => character.charCodeAt(0))),
    );
  } catch {
    return text;
  }
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FormDialog({
  type,
  categories,
  quotes = [],
}: {
  type: "transaction" | "category" | "goal" | "budget" | "holding";
  categories: Category[];
  quotes?: Quote[];
}) {
  const [open, setOpen] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [transactionType, setTransactionType] = useState("expense");
  const [transactionCategoryId, setTransactionCategoryId] = useState("none");
  const [holdingType, setHoldingType] = useState<keyof typeof investmentOptions>(
    "stock",
  );
  const [holdingSymbol, setHoldingSymbol] = useState("");
  const [cryptoPurchaseValue, setCryptoPurchaseValue] = useState("");
  const [fixedIncomeValue, setFixedIncomeValue] = useState("");
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const cryptoQuote = quotes.find((quote) => quote.symbol === holdingSymbol);
  const cryptoPurchaseReais = Number(cryptoPurchaseValue.replace(",", "."));
  const cryptoQuantity =
    holdingType === "crypto" && cryptoQuote?.value && cryptoPurchaseReais > 0
      ? cryptoPurchaseReais / cryptoQuote.value
      : 0;
  const cryptoSatoshis =
    holdingSymbol === "BTC" ? Math.round(cryptoQuantity * 100_000_000) : null;
  const transactionCategories = categories.filter(
    (category) => category.type === transactionType,
  );
  const selectedTransactionCategory = categories.find(
    (category) => String(category.id) === transactionCategoryId,
  );
  const transactionIsStreaming = isStreamingCategory(selectedTransactionCategory);
  const meta = {
    transaction: ["Novo lançamento", "Registre uma receita ou despesa."],
    category: ["Nova categoria", "Personalize a organização dos seus gastos."],
    goal: ["Nova meta", "Defina um objetivo financeiro."],
    budget: ["Novo orçamento", "Crie um limite mensal."],
    holding: ["Novo ativo", "Adicione um investimento à carteira."],
  }[type];
  function submit(form: FormData) {
    const actions = {
      transaction: addTransaction,
      category: addCategory,
      goal: addGoal,
      budget: addBudget,
      holding: addHolding,
    };
    startTransition(async () => {
      try {
        await actions[type](form);
        setOpen(false);
        toast.success("Dados salvos com sucesso.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível salvar.",
        );
      }
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={type === "transaction" ? "default" : "outline"}
            size="sm"
          />
        }
      >
        <Plus data-icon="inline-start" />
        {meta[0]}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{meta[0]}</DialogTitle>
          <DialogDescription>{meta[1]}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          {type === "transaction" && (
            <>
              {transactionIsStreaming ? (
                <Field label="Qual streaming?">
                  <Select name="description" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {streamingServices.map((service) => (
                          <SelectItem key={service} value={service}>
                            {streamingServiceImages[service] && (
                              <Image
                                src={streamingServiceImages[service]}
                                width={18}
                                height={18}
                                alt=""
                                className="size-[18px] rounded object-contain"
                              />
                            )}
                            {service}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field label="Descrição">
                  <Input name="description" placeholder="Ex.: Supermercado" required />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo">
                  <Select
                    name="type"
                    value={transactionType}
                    onValueChange={(value) => {
                      const nextType = String(value);
                      setTransactionType(nextType);
                      const selected = categories.find(
                        (category) => String(category.id) === transactionCategoryId,
                      );
                      if (!selected || selected.type !== nextType) setTransactionCategoryId("none");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Valor">
                  <Input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Categoria">
                  <Select
                    name="categoryId"
                    value={transactionCategoryId}
                    onValueChange={(value) => setTransactionCategoryId(String(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {transactionCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Primeira data">
                  <Input
                    name="date"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <input
                  name="recurring"
                  type="checkbox"
                  value="true"
                  checked={recurring}
                  onChange={(event) => setRecurring(event.target.checked)}
                />
                <span>
                  <span className="block font-medium">Repetir mensalmente</span>
                  <span className="text-xs text-muted-foreground">
                    Cria o lançamento no mesmo dia de cada mês.
                  </span>
                </span>
              </label>
              {recurring && (
                <Field label="Repetir até">
                  <Input
                    name="recurrenceEnd"
                    type="date"
                    min={today}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    A última cobrança será criada até esta data.
                  </p>
                </Field>
              )}
            </>
          )}
          {type === "category" && (
            <>
              <Field label="Nome">
                <Input name="name" placeholder="Ex.: Educação" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo">
                  <Select name="type" defaultValue="expense">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Ícone padrão">
                  <Select name="icon" defaultValue="wallet">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categoryIconOptions.map(([value, label]) => {
                          const Icon = categoryIcons[value];
                          return (
                            <SelectItem key={value} value={value}>
                              <Icon className="size-4" />
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Imagem personalizada (opcional)">
                <Input
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WebP ou AVIF, com até 2 MB. A imagem substitui o
                  ícone padrão.
                </p>
              </Field>
              <input type="hidden" name="color" value="blue" />
            </>
          )}
          {type === "goal" && (
            <>
              <Field label="Nome">
                <Input
                  name="name"
                  placeholder="Ex.: Reserva de emergência"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Objetivo">
                  <Input
                    name="target"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                  />
                </Field>
                <Field label="Valor atual">
                  <Input
                    name="current"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                    required
                  />
                </Field>
              </div>
              <Field label="Prazo">
                <Input name="deadline" type="date" />
              </Field>
            </>
          )}
          {type === "budget" && (
            <>
              <Field label="Nome">
                <Input name="name" placeholder="Ex.: Alimentação" required />
              </Field>
              <Field label="Categoria monitorada">
                <Select name="categoryId" required>
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
                  min="1"
                  step="0.01"
                  required
                />
              </Field>
              <Field label="Mês">
                <Input
                  name="month"
                  type="month"
                  defaultValue={month}
                  required
                />
              </Field>
            </>
          )}
          {type === "holding" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo">
                  <Select
                    name="assetType"
                    value={holdingType}
                    onValueChange={(value) => {
                      setHoldingType(value as keyof typeof investmentOptions);
                      setHoldingSymbol("");
                      setCryptoPurchaseValue("");
                      setFixedIncomeValue("");
                    }}
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
                <Field label="Ativo">
                  <Select
                    key={holdingType}
                    name="symbol"
                    value={holdingSymbol}
                    onValueChange={(value) => setHoldingSymbol(value ?? "")}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {investmentOptions[holdingType].map(([symbol, name]) => (
                          <SelectItem key={symbol} value={symbol}>
                            <span className="font-mono font-semibold">{symbol}</span>
                            <span className="text-muted-foreground">{name}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {holdingType === "crypto" ? (
                <>
                  <Field label="Valor da compra">
                    <Input
                      value={cryptoPurchaseValue}
                      onChange={(event) => setCryptoPurchaseValue(event.target.value)}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="R$ 0,00"
                      required
                    />
                  </Field>
                  <input type="hidden" name="quantity" value={cryptoQuantity || ""} />
                  <input type="hidden" name="averageCost" value={cryptoQuote?.value ?? ""} />
                  <div className="rounded-xl border bg-muted/30 p-4">
                    {holdingSymbol && !cryptoQuote ? (
                      <p className="text-sm text-amber-400">
                        Cotação de {holdingSymbol} indisponível. Selecione BTC para calcular automaticamente.
                      </p>
                    ) : cryptoQuantity > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Você receberá aproximadamente</p>
                          <p className="mt-1 font-mono text-lg font-semibold">
                            {cryptoQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} {holdingSymbol}
                          </p>
                        </div>
                        {cryptoSatoshis !== null && (
                          <div>
                            <p className="text-xs text-muted-foreground">Em satoshis</p>
                            <p className="mt-1 font-mono text-lg font-semibold text-cyan-400">
                              {cryptoSatoshis.toLocaleString("pt-BR")} sats
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          Cotação usada: {brl(Math.round((cryptoQuote?.value ?? 0) * 100))} por {holdingSymbol}.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Selecione o ativo e informe quanto você pagou para ver a conversão.
                      </p>
                    )}
                  </div>
                </>
              ) : isFixedIncomeType(holdingType) ? (
                <>
                  <Field label="Valor aplicado">
                    <Input
                      value={fixedIncomeValue}
                      onChange={(event) => setFixedIncomeValue(event.target.value)}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="R$ 0,00"
                      required
                    />
                  </Field>
                  <input type="hidden" name="quantity" value="1" />
                  <input type="hidden" name="averageCost" value={fixedIncomeValue} />
                  <Field label="Data da aplicação">
                    <Input
                      name="applicationDate"
                      type="date"
                      max={today}
                      defaultValue={today}
                      required
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Informe o total aplicado. A rentabilidade poderá ser acompanhada conforme os rendimentos forem atualizados.
                  </p>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Quantidade">
                    <Input name="quantity" type="number" min="0.00000001" step="any" required />
                  </Field>
                  <Field label="Preço médio">
                    <Input name="averageCost" type="number" min="0.01" step="0.01" required />
                  </Field>
                </div>
              )}
            </>
          )}
          <Button
            type="submit"
            disabled={
              pending ||
              (type === "holding" &&
                holdingType === "crypto" &&
                (!cryptoQuote || cryptoQuantity <= 0))
            }
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FinanceDashboard({
  currentDate,
  user,
  transactions,
  categories,
  goals,
  budgets,
  holdings,
  quotes,
  stockQuotes,
}: Props) {
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [displayName, setDisplayName] = useState(user.name);
  const [displayImage, setDisplayImage] = useState(user.image);
  const { income, expense, flow, categoryTotals } = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + offset, 1);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        month: new Intl.DateTimeFormat("pt-BR", { month: "short" })
          .format(date)
          .replace(".", ""),
        receitas: 0,
        despesas: 0,
        saldo: 0,
      };
    });
    const lookup = new Map(buckets.map((item) => [item.key, item]));
    const totals = new Map<number, number>();
    let income = 0,
      expense = 0;
    for (const tx of transactions) {
      if (tx.date > currentDate) continue;
      if (tx.type === "income") income += tx.amountCents;
      else if (tx.type === "expense") {
        expense += tx.amountCents;
        if (tx.categoryId)
          totals.set(
            tx.categoryId,
            (totals.get(tx.categoryId) ?? 0) + tx.amountCents,
          );
      }
      const bucket = lookup.get(tx.date.slice(0, 7));
      if (bucket) {
        if (tx.type === "income") bucket.receitas += tx.amountCents / 100;
        else bucket.despesas += tx.amountCents / 100;
        bucket.saldo = bucket.receitas - bucket.despesas;
      }
    }
    return { income, expense, flow: buckets, categoryTotals: totals };
  }, [currentDate, transactions]);
  const balance = income - expense;
  const byCategory = useMemo(
    () =>
      categories
        .map((c, i) => ({
          name: c.name,
          value: (categoryTotals.get(c.id) ?? 0) / 100,
          fill: `var(--chart-${(i % 3) + 1})`,
        }))
        .filter((x) => x.value > 0),
    [categories, categoryTotals],
  );
  const savings = income ? Math.round((balance / income) * 100) : 0;
  const initials = displayName
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const titles = {
    dashboard: ["Visão geral", "Acompanhe sua vida financeira em um só lugar."],
    reports: [
      "Relatórios",
      "Explore tendências e indicadores da sua vida financeira.",
    ],
    tools: [
      "Ferramentas",
      "Planeje cenários, acompanhe alertas e consulte seu calendário.",
    ],
    transactions: [
      "Transações",
      "Consulte e organize todas as receitas e despesas.",
    ],
    planning: ["Planejamento", "Transforme seus objetivos em planos mensais."],
    investment: [
      "Investment",
      "Entenda como distribuir seu dinheiro de acordo com objetivos, liquidez e risco.",
    ],
    investments: [
      "Investimentos",
      "Acompanhe sua carteira e as cotações do mercado.",
    ],
    categories: [
      "Categorias",
      "Personalize como seus lançamentos são organizados.",
    ],
    settings: ["Configurações", "Gerencie seu perfil, conta e preferências."],
  };
  function navigate(next: View) {
    setView(next);
    setMobile(false);
    setSidebarVisible(false);
  }
  async function logout() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }
  return (
    <div className="min-h-svh bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r bg-sidebar p-4 transition-transform ${mobile ? "translate-x-0" : "-translate-x-full"} ${sidebarVisible ? "lg:translate-x-0" : "lg:-translate-x-full"}`}
      >
        <div className="flex h-12 items-center gap-3 px-2 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <WalletCards />
          </span>
          Clareza
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          <Nav
            icon={LayoutDashboard}
            active={view === "dashboard"}
            onClick={() => navigate("dashboard")}
          >
            Painel
          </Nav>
          <Nav
            icon={ChartColumn}
            active={view === "reports"}
            onClick={() => navigate("reports")}
          >
            Relatórios
          </Nav>
          <Nav
            icon={CalendarDays}
            active={view === "tools"}
            onClick={() => navigate("tools")}
          >
            Ferramentas
          </Nav>
          <Nav
            icon={ReceiptText}
            active={view === "transactions"}
            onClick={() => navigate("transactions")}
          >
            Transações
          </Nav>
          <Nav
            icon={Target}
            active={view === "planning"}
            onClick={() => navigate("planning")}
          >
            Planejamento
          </Nav>
          <Nav
            icon={Lightbulb}
            active={view === "investment"}
            onClick={() => navigate("investment")}
          >
            Investment
          </Nav>
          <Nav
            icon={TrendingUp}
            active={view === "investments"}
            onClick={() => navigate("investments")}
          >
            Investimentos
          </Nav>
          <Nav
            icon={Settings2}
            active={view === "categories"}
            onClick={() => navigate("categories")}
          >
            Categorias
          </Nav>
          <Nav
            icon={UserRound}
            active={view === "settings"}
            onClick={() => navigate("settings")}
          >
            Configurações
          </Nav>
        </nav>
        <Separator />
        <button
          onClick={logout}
          className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </aside>
      {mobile && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-10 bg-foreground/20 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <main
        className={`transition-[padding] ${sidebarVisible ? "lg:pl-64" : "lg:pl-0"}`}
      >
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => setSidebarVisible((value) => !value)}
              aria-label={
                sidebarVisible ? "Ocultar menu lateral" : "Mostrar menu lateral"
              }
              title={
                sidebarVisible ? "Ocultar menu lateral" : "Mostrar menu lateral"
              }
            >
              <Menu />
            </Button>
            <div>
              <p className="text-sm font-semibold">
                Olá, {displayName.split(" ")[0]}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Seu dinheiro, com mais clareza
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LocationTag />
            <NotificationMenu
              transactions={transactions}
              budgets={budgets}
              categories={categories}
              currentDate={currentDate}
            />
            <ThemeToggle />
            <FormDialog type="transaction" categories={categories} />
            <AccountMenu
              initials={initials}
              image={displayImage}
              onProfile={() => navigate("settings")}
              onBilling={() => navigate("planning")}
              onSettings={() => navigate("settings")}
              onLogout={logout}
            />
          </div>
        </header>
        <div key={view} className="tab-content-enter mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
          <section>
            <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
              {titles[view][0]}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {titles[view][1]}
            </p>
          </section>
          {view === "dashboard" && (
            <div className="dashboard-feature-enabled flex flex-col gap-6">
              <DashboardView
                income={income}
                expense={expense}
                balance={balance}
                savings={savings}
                flow={flow}
                byCategory={byCategory}
                transactions={transactions}
                categories={categories}
                goals={goals}
                budgets={budgets}
                holdings={holdings}
                currentDate={currentDate}
              />
              <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(300px,1fr)_minmax(0,2fr)]">
                <GoalsFeatureCard goals={goals} />
                <TransactionTable
                  transactions={transactions.filter(
                    (transaction) => transaction.date <= currentDate,
                  )}
                  categories={categories}
                />
              </div>
              <Insights savings={savings} expense={expense} income={income} />
            </div>
          )}
          {view === "reports" && (
            <ReportsView
              income={income}
              expense={expense}
              savings={savings}
              flow={flow}
              byCategory={byCategory}
              transactions={transactions}
              currentDate={currentDate}
            />
          )}
          {view === "tools" && (
            <ToolsView
              transactions={transactions}
              income={income}
              expense={expense}
              savings={savings}
            />
          )}
          {view === "transactions" && (
            <section className="flex flex-col gap-4">
              <div className="flex justify-end">
                <FormDialog type="transaction" categories={categories} />
              </div>
              <TransactionTable
                transactions={transactions.filter(
                  (transaction) =>
                    transaction.date.slice(0, 7) <= currentDate.slice(0, 7),
                )}
                categories={categories}
                all
              />
            </section>
          )}
          {view === "planning" && (
            <div className="flex flex-col gap-6">
              <FinancialGoalsOrbit goals={goals} />
              <PlanningView
                goals={goals}
                budgets={budgets}
                categories={categories}
              />
            </div>
          )}
          {view === "investment" && (
            <InvestmentGuideView
              transactions={transactions}
              goals={goals}
              holdings={holdings}
              currentDate={currentDate}
            />
          )}
          {view === "investments" && (
            <InvestmentsView
              holdings={holdings}
              quotes={quotes}
              stockQuotes={stockQuotes}
              categories={categories}
            />
          )}
          {view === "categories" && <CategoriesView categories={categories} />}
          {view === "settings" && (
            <SettingsView
              user={{ ...user, name: displayName, image: displayImage }}
              onNameChange={setDisplayName}
              onImageChange={setDisplayImage}
              transactionCount={transactions.length}
              goalCount={goals.length}
              investmentCount={holdings.length}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function NotificationMenu({
  transactions,
  budgets,
  categories,
  currentDate,
}: {
  transactions: Tx[];
  budgets: Budget[];
  categories: Category[];
  currentDate: string;
}) {
  const [open, setOpen] = useState(false);
  const alerts = getBudgetAlerts(
    transactions,
    budgets,
    categories,
    currentDate,
  );
  const currentMonth = currentDate.slice(0, 7);
  const budgetCategoryIds = new Set(
    budgets
      .filter((budget) => budget.month === currentMonth)
      .map((budget) => budget.categoryId ?? categories.find(
        (category) => category.name.trim().toLocaleLowerCase("pt-BR") === budget.name.trim().toLocaleLowerCase("pt-BR"),
      )?.id)
      .filter((categoryId): categoryId is number => Boolean(categoryId)),
  );
  const highExpenses = transactions
    .filter(
      (transaction) =>
        transaction.type === "expense" &&
        transaction.date.startsWith(currentMonth) &&
        transaction.date <= currentDate &&
        transaction.amountCents >= 100_000 &&
        (!transaction.categoryId || !budgetCategoryIds.has(transaction.categoryId)),
    )
    .slice(0, 5);
  const notificationCount = alerts.length + highExpenses.length;
  return (
    <div className="relative z-50">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notificações${notificationCount ? `, ${notificationCount} alerta${notificationCount === 1 ? "" : "s"}` : ""}`}
        aria-expanded={open}
      >
        <Bell className="size-4" />
        {notificationCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,.8)]" />
        )}
      </Button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar notificações"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl">
            <div className="flex items-center justify-between px-2 py-2">
              <div>
                <p className="text-sm font-semibold">Notificações</p>
                <p className="text-xs text-muted-foreground">Alertas dos seus orçamentos</p>
              </div>
              {notificationCount > 0 && <Badge variant="secondary">{notificationCount}</Badge>}
            </div>
            <Separator className="my-1" />
            {notificationCount ? (
              <AnimatedList className="max-h-80 overflow-y-auto">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex gap-3 rounded-lg p-2.5 hover:bg-muted/60">
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${alert.percentage >= 100 ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"}`}>
                      <TriangleAlert className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{alert.name}</span>
                        <span className="font-mono text-xs font-semibold">{alert.percentage}%</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{brl(alert.spent)} usados de {brl(alert.limitCents)}</p>
                      <Progress className="mt-2 h-1" value={Math.min(alert.percentage, 100)} />
                    </div>
                  </div>
                ))}
                {highExpenses.map((transaction) => (
                  <div key={`expense-${transaction.id}`} className="flex gap-3 rounded-lg p-2.5 hover:bg-muted/60">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                      <ReceiptText className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate font-medium">Despesa alta</span>
                        <span className="font-mono text-xs font-semibold text-rose-400">-{brl(transaction.amountCents)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {transaction.description} não possui orçamento vinculado neste mês.
                      </p>
                    </div>
                  </div>
                ))}
              </AnimatedList>
            ) : (
              <div className="px-3 py-8 text-center">
                <Bell className="mx-auto mb-2 size-5 text-cyan-400" />
                <p className="text-sm font-medium">Tudo sob controle</p>
                <p className="mt-1 text-xs text-muted-foreground">Nenhum orçamento atingiu 70% e não há despesas altas sem cobertura.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AccountMenu({
  initials,
  image,
  onProfile,
  onBilling,
  onSettings,
  onLogout,
}: {
  initials: string;
  image: string | null;
  onProfile: () => void;
  onBilling: () => void;
  onSettings: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };
  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full outline-none ring-offset-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Avatar className="size-9 border border-white/10 bg-[#17191c]">
          {image && <AvatarImage src={image} alt="Foto do perfil" />}
          <AvatarFallback className="bg-[#17191c] text-xs text-zinc-400">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar menu da conta"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-lg border border-[#383838] bg-[#171717] p-2 text-zinc-300 shadow-[0_18px_55px_rgba(0,0,0,.55)]"
          >
            <AccountMenuItem icon={UserRound} onClick={() => choose(onProfile)}>
              Perfil
            </AccountMenuItem>
            <AccountMenuItem
              icon={CreditCard}
              onClick={() => choose(onBilling)}
            >
              Faturamento
            </AccountMenuItem>
            <AccountMenuItem
              icon={Settings2}
              onClick={() => choose(onSettings)}
            >
              Configurações
            </AccountMenuItem>
            <div className="my-2 h-px bg-[#303030]" />
            <AccountMenuItem
              icon={LogOut}
              danger
              onClick={() => choose(onLogout)}
            >
              Sair
            </AccountMenuItem>
          </div>
        </>
      )}
    </div>
  );
}

function AccountMenuItem({
  icon: Icon,
  children,
  onClick,
  danger = false,
}: {
  icon: typeof UserRound;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${danger ? "text-rose-500 hover:bg-rose-500/10" : "hover:bg-white/[.06] hover:text-white"}`}
    >
      <Icon className="size-4" strokeWidth={1.8} />
      {children}
    </button>
  );
}

function SettingsView({
  user,
  onNameChange,
  onImageChange,
  transactionCount,
  goalCount,
  investmentCount,
}: {
  user: { name: string; email: string; image: string | null };
  onNameChange: (name: string) => void;
  onImageChange: (image: string | null) => void;
  transactionCount: number;
  goalCount: number;
  investmentCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        const result = await updateUserProfile(form);
        onNameChange(result.name);
        onImageChange(result.image);
        setRemoveImage(false);
        router.refresh();
        toast.success("Perfil atualizado com sucesso.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o perfil.",
        );
      }
    });
  }
  function changePassword(form: FormData) {
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da nova senha não confere.");
      return;
    }
    startPasswordTransition(async () => {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) {
        toast.error(result.error.message || "Não foi possível alterar a senha.");
        return;
      }
      toast.success("Senha alterada com sucesso.");
    });
  }
  function deleteAccount(form: FormData) {
    const confirmation = String(form.get("confirmation") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (confirmation.toLocaleLowerCase("pt-BR") !== user.email.toLocaleLowerCase("pt-BR")) {
      toast.error("Digite o e-mail da conta exatamente como informado.");
      return;
    }
    startDeleteTransition(async () => {
      const result = await authClient.deleteUser({ password });
      if (result.error) {
        toast.error(result.error.message || "Não foi possível apagar a conta.");
        return;
      }
      toast.success("Conta apagada permanentemente.");
      router.push("/sign-up");
      router.refresh();
    });
  }
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex flex-col gap-6">
      <Card className="profile-card-enter group relative overflow-hidden border-cyan-400/15 bg-gradient-to-br from-card via-card to-cyan-500/[.06]">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-cyan-400/[.09] blur-3xl transition-transform duration-700 group-hover:scale-125" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-64 rounded-full bg-violet-500/[.07] blur-3xl" />
        <CardContent className="relative p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative">
                <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 opacity-70 blur-sm" />
                <Avatar className="relative size-20 border-2 border-background bg-card">
                  {user.image && !removeImage && <AvatarImage src={user.image} alt={`Foto de ${user.name}`} />}
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500/15 to-violet-500/15 text-xl font-semibold text-cyan-300">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 size-4 rounded-full border-2 border-card bg-emerald-400" title="Conta ativa" />
              </div>
              <div className="min-w-0">
                <Badge variant="outline" className="mb-2 border-cyan-400/20 text-cyan-400">Perfil pessoal</Badge>
                <h2 className="truncate text-xl font-semibold md:text-2xl">{user.name}</h2>
                <p className="mt-1 flex items-center gap-2 truncate text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  {user.email}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                [transactionCount, "Transações"],
                [goalCount, "Metas"],
                [investmentCount, "Ativos"],
              ].map(([value, label]) => (
                <div key={label} className="min-w-20 rounded-xl border bg-background/40 px-3 py-3 text-center backdrop-blur-sm">
                  <p className="font-mono text-lg font-semibold text-cyan-400">{value}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-14 border border-primary/20">
              {user.image && !removeImage && <AvatarImage src={user.image} alt={`Foto de ${user.name}`} />}
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>Perfil pessoal</CardTitle>
              <CardDescription>
                Informações usadas para identificar sua conta.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form action={submit} className="flex max-w-xl flex-col gap-5">
            <Field label="Foto de perfil">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
                  <Camera className="size-4" />
                  Escolher foto
                  <input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/avif,.avif" className="sr-only" onChange={() => setRemoveImage(false)} />
                </label>
                {user.image && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setRemoveImage(true)} disabled={removeImage}>
                    <Trash2 className="size-4" />
                    {removeImage ? "Foto será removida" : "Remover foto"}
                  </Button>
                )}
              </div>
              <input type="hidden" name="removeImage" value={removeImage ? "true" : "false"} />
              <p className="text-xs text-muted-foreground">PNG, JPG, WebP ou AVIF, com até 2 MB.</p>
            </Field>
            <Field label="Nome completo">
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="name"
                  defaultValue={user.name}
                  minLength={2}
                  maxLength={80}
                  className="pl-10"
                  required
                />
              </div>
            </Field>
            <Field label="E-mail">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={user.email} className="pl-10" disabled readOnly />
              </div>
              <p className="text-xs text-muted-foreground">
                O e-mail de acesso não pode ser alterado por aqui.
              </p>
            </Field>
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-400">
                <Palette className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base">Aparência</CardTitle>
                <CardDescription>Personalize a interface.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">Tema da interface</p>
                <p className="text-xs text-muted-foreground">
                  Claro, escuro ou automático
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-400">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base">Alterar senha</CardTitle>
                <CardDescription>Proteja o acesso à sua conta.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form action={changePassword} className="space-y-4">
              <Field label="Senha atual">
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input name="currentPassword" type="password" autoComplete="current-password" className="pl-10" minLength={8} required />
                </div>
              </Field>
              <Field label="Nova senha">
                <Input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
              </Field>
              <Field label="Confirmar nova senha">
                <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
              </Field>
              <Button type="submit" className="w-full" disabled={passwordPending}>
                <ShieldCheck className="size-4" />
                {passwordPending ? "Alterando…" : "Alterar senha"}
              </Button>
              <p className="text-xs text-muted-foreground">Ao alterar, as outras sessões serão desconectadas.</p>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>
      <Card className="border-rose-500/25 bg-rose-500/[.025]">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-400">
              <TriangleAlert className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base text-rose-400">Zona de perigo</CardTitle>
              <CardDescription>Apague permanentemente sua conta e todos os dados financeiros.</CardDescription>
            </div>
          </div>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger render={<Button variant="destructive" />}>Apagar conta</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apagar sua conta?</DialogTitle>
                <DialogDescription>
                  Esta ação não pode ser desfeita. Transações, categorias, metas, orçamentos, investimentos e imagens serão excluídos.
                </DialogDescription>
              </DialogHeader>
              <form action={deleteAccount} className="flex flex-col gap-4">
                <Field label={`Digite ${user.email} para confirmar`}>
                  <Input name="confirmation" type="email" autoComplete="off" required />
                </Field>
                <Field label="Senha atual">
                  <Input name="password" type="password" autoComplete="current-password" minLength={8} required />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deletePending}>Cancelar</Button>
                  <Button type="submit" variant="destructive" disabled={deletePending}>
                    <Trash2 className="size-4" />
                    {deletePending ? "Apagando…" : "Apagar permanentemente"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>
    </div>
  );
}

function Nav({
  icon: Icon,
  children,
  active,
  onClick,
}: {
  icon: typeof Target;
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 ${active ? "translate-x-1 bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--primary)]" : "text-muted-foreground hover:translate-x-0.5 hover:bg-sidebar-accent"}`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
function DashboardView({
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
function ReportsView({
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

function ForecastCard({
  transactions,
  currentDate,
}: {
  transactions: Tx[];
  currentDate: string;
}) {
  const currentMonth = currentDate.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const monthTransactions = transactions.filter((item) =>
    item.date.startsWith(selectedMonth),
  );
  const isCurrentMonth = selectedMonth === currentMonth;
  const isFutureMonth = selectedMonth > currentMonth;
  const futureTransactions = monthTransactions.filter(
    (item) => isFutureMonth || (isCurrentMonth && item.date > currentDate),
  );
  const realizedIncome = monthTransactions
    .filter(
      (item) =>
        item.type === "income" &&
        !isFutureMonth &&
        (!isCurrentMonth || item.date <= currentDate),
    )
    .reduce((sum, item) => sum + item.amountCents, 0);
  const realizedExpense = monthTransactions
    .filter(
      (item) =>
        item.type === "expense" &&
        !isFutureMonth &&
        (!isCurrentMonth || item.date <= currentDate),
    )
    .reduce((sum, item) => sum + item.amountCents, 0);
  const pendingIncome = futureTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const pendingExpense = futureTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const projectedBalance =
    realizedIncome - realizedExpense + pendingIncome - pendingExpense;
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
function ReportInsight({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-muted/35 p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
function ToolsView({
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
  const months = Math.max(1, years * 12);
  const monthlyRate = Math.pow(1 + rate / 100, 1 / 12) - 1;
  const future = Math.round(
    initial * Math.pow(1 + monthlyRate, months) +
      monthly *
        (monthlyRate
          ? (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate
          : months),
  );
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTransactions = transactions.filter((item) =>
    item.date.startsWith(currentMonth),
  );
  const alerts: string[] = [];
  if (income === 0)
    alerts.push(
      "Cadastre uma receita para acompanhar sua capacidade de pagamento.",
    );
  if (expense > income && income > 0)
    alerts.push("Suas despesas acumuladas superaram as receitas.");
  if (savings < 10 && income > 0)
    alerts.push("Sua taxa de economia está abaixo de 10%.");
  const largestExpense = [...transactions]
    .filter((item) => item.type === "expense")
    .sort((a, b) => b.amountCents - a.amountCents)[0];
  if (largestExpense && income && largestExpense.amountCents > income * 0.3)
    alerts.push(
      `O lançamento “${largestExpense.description}” representa mais de 30% das receitas.`,
    );
  if (!alerts.length)
    alerts.push("Nenhum alerta crítico identificado com os dados atuais.");
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
function EditGoalDialog({ goal }: { goal: GoalType }) {
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
function EditBudgetDialog({ budget, categories }: { budget: Budget; categories: Category[] }) {
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
function PlanningView({
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
function EditHoldingDialog({ holding }: { holding: Holding }) {
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
function InvestmentGuideView({
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

function InvestmentsView({
  holdings,
  quotes,
  stockQuotes,
  categories,
}: {
  holdings: Holding[];
  quotes: Quote[];
  stockQuotes: StockQuote[];
  categories: Category[];
}) {
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
        <StockMarket quotes={stockQuotes} />
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
      <Quotes quotes={quotes} />
    </div>
  );
}

function HoldingFlipCard({
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
  const invested = quantity * holding.averageCostCents;
  const fixedIncome = isFixedIncomeType(holding.assetType);
  const currentPriceCents = fixedIncome
    ? null
    : stockQuote
    ? Math.round(stockQuote.price * 100)
    : marketQuote
      ? Math.round(marketQuote.value * 100)
      : null;
  const currentValue = currentPriceCents === null ? null : quantity * currentPriceCents;
  const result = currentValue === null ? null : currentValue - invested;
  const resultPercentage = invested && result !== null ? (result / invested) * 100 : null;
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
function StockMarket({ quotes }: { quotes: StockQuote[] }) {
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
function StockMetricCard({
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
function StockLogo({ quote }: { quote: StockQuote }) {
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
function EditCategoryDialog({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        await updateCategory(category.id, form);
        setOpen(false);
        toast.success("Categoria atualizada.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a categoria.",
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
            aria-label={`Editar ${category.name}`}
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar categoria</DialogTitle>
          <DialogDescription>
            Altere os dados e o ícone desta categoria.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" defaultValue={category.name} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select name="type" defaultValue={category.type}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ícone padrão">
              <Select name="icon" defaultValue={category.icon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categoryIconOptions.map(([value, label]) => {
                      const Icon = categoryIcons[value];
                      return (
                        <SelectItem key={value} value={value}>
                          <Icon className="size-4" />
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Nova imagem personalizada">
            <Input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
            />
          </Field>
          {category.imagePath && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeImage" value="true" />
              Remover imagem atual e usar o ícone padrão
            </label>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function CategoriesView({ categories }: { categories: Category[] }) {
  async function remove(category: Category) {
    if (
      !window.confirm(
        `Excluir a categoria “${category.name}”? As transações serão mantidas sem categoria.`,
      )
    )
      return;
    try {
      await deleteCategory(category.id);
      toast.success("Categoria excluída.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a categoria.",
      );
    }
  }
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Suas categorias</CardTitle>
          <CardDescription>
            Use categorias para entender para onde vai seu dinheiro
          </CardDescription>
        </div>
        <FormDialog type="category" categories={categories} />
      </CardHeader>
      <CardContent>
        {categories.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => {
              const Icon =
                categoryIcons[c.icon as keyof typeof categoryIcons] ??
                WalletCards;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                      {c.imagePath ? (
                        <Image
                          src={c.imagePath}
                          width={40}
                          height={40}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <Icon className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.type === "income" ? "Receita" : "Despesa"}
                      </p>
                    </div>
                  </div>
                  <div className="ml-2 flex shrink-0">
                    <EditCategoryDialog category={c} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ${c.name}`}
                      onClick={() => void remove(c)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="Crie categorias para organizar seus lançamentos." />
        )}
      </CardContent>
    </Card>
  );
}
function Metric({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: typeof Target;
}) {
  const accent =
    title === "Receitas acumuladas"
      ? "text-emerald-500 dark:text-emerald-400"
      : title === "Despesas acumuladas"
        ? "text-rose-500 dark:text-rose-400"
        : title === "Patrimônio investido"
          ? "text-sky-500 dark:text-sky-400"
          : "text-emerald-500 dark:text-emerald-400";
  return (
    <AnimatedCard className="overflow-hidden border-0 bg-card shadow-[0_10px_35px_rgba(0,0,0,.14)]">
      <CardHeader className="relative flex-row items-center justify-between pb-3">
        <CardDescription className="text-[13px] font-medium text-muted-foreground">
          {title}
        </CardDescription>
        <span className="flex size-9 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-muted-foreground">
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
      </CardHeader>
      <CardContent className="relative">
        <p className="font-mono text-2xl font-semibold tracking-[-.04em] text-foreground">
          {value}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className={`size-1.5 rounded-full bg-current ${accent}`} />
          <p className={`text-xs font-medium ${accent}`}>{note}</p>
        </div>
      </CardContent>
    </AnimatedCard>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
function EditTransactionDialog({
  transaction,
  categories,
}: {
  transaction: Tx;
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [repeatFromHere, setRepeatFromHere] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState(transaction.type);
  const [categoryId, setCategoryId] = useState(() =>
    transaction.categoryId && categories.some(
      (category) => category.id === transaction.categoryId && category.type === transaction.type,
    ) ? String(transaction.categoryId) : "none",
  );
  const compatibleCategories = categories.filter(
    (category) => category.type === type,
  );
  const selectedCategory = categories.find(
    (category) => String(category.id) === categoryId,
  );
  const transactionIsStreaming = isStreamingCategory(selectedCategory);
  const currentStreamingService = streamingServices.includes(
    transaction.description as (typeof streamingServices)[number],
  )
    ? transaction.description
    : undefined;
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        await updateTransaction(transaction.id, form);
        setOpen(false);
        toast.success("Lançamento atualizado.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o lançamento.",
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
            aria-label={`Editar ${transaction.description}`}
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>
            Corrija os dados registrados nesta movimentação.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          {transactionIsStreaming ? (
            <Field label="Qual streaming?">
              <Select
                key={`${transaction.id}-${categoryId}`}
                name="description"
                defaultValue={currentStreamingService}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {!currentStreamingService && (
                      <SelectItem value={transaction.description}>
                        {transaction.description}
                      </SelectItem>
                    )}
                    {streamingServices.map((service) => (
                      <SelectItem key={service} value={service}>
                        {streamingServiceImages[service] && (
                          <Image
                            src={streamingServiceImages[service]}
                            width={18}
                            height={18}
                            alt=""
                            className="size-[18px] rounded object-contain"
                          />
                        )}
                        {service}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label="Descrição">
              <Input name="description" defaultValue={transaction.description} required />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select
                name="type"
                value={type}
                onValueChange={(value) => {
                  const nextType = String(value);
                  setType(nextType);
                  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
                  if (!selectedCategory || selectedCategory.type !== nextType) setCategoryId("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valor">
              <Input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={(transaction.amountCents / 100).toFixed(2)}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria">
              <Select
                name="categoryId"
                value={categoryId}
                onValueChange={(value) => setCategoryId(String(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {compatibleCategories.map((category) => {
                      const Icon =
                        categoryIcons[
                          category.icon as keyof typeof categoryIcons
                        ] ?? WalletCards;
                      return (
                        <SelectItem
                          key={category.id}
                          value={String(category.id)}
                        >
                          <Icon className="size-4" />
                          {category.name}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data">
              <Input
                name="date"
                type="date"
                defaultValue={transaction.date}
                required
              />
            </Field>
          </div>
          <Field label="Imagem desta transação (opcional)">
            <Input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WebP ou AVIF, com até 2 MB.
            </p>
          </Field>
          {transaction.imagePath && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeImage" value="true" />
              Remover imagem própria e voltar a usar a imagem da categoria
            </label>
          )}
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input
              name="recurring"
              type="checkbox"
              value="true"
              checked={repeatFromHere}
              onChange={(event) => setRepeatFromHere(event.target.checked)}
            />
            <span>
              <span className="block font-medium">
                Repetir mensalmente a partir daqui
              </span>
              <span className="text-xs text-muted-foreground">
                Cria novas ocorrências sem alterar as anteriores.
              </span>
            </span>
          </label>
          {repeatFromHere && (
            <Field label="Repetir até">
              <Input
                name="recurrenceEnd"
                type="date"
                min={transaction.date}
                required
              />
            </Field>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function TransactionLabel({
  transaction,
  categories,
}: {
  transaction: Tx;
  categories: Category[];
}) {
  const category = categories.find(
    (item) => item.id === transaction.categoryId,
  );
  const streamingImage = isStreamingCategory(category)
    ? getStreamingServiceImage(transaction.description)
    : undefined;
  const customImage =
    transaction.imagePath ??
    streamingImage ??
    category?.imagePath ??
    transaction.categoryImage;
  const icon = category?.icon ?? transaction.categoryIcon;
  const iconKey = icon as keyof typeof categoryIcons;
  const isShell =
    !customImage &&
    /\b(gasolina|combust[ií]vel|posto shell|shell)\b/i.test(
      transaction.description,
    );
  const Icon = icon ? (categoryIcons[iconKey] ?? WalletCards) : ReceiptText;
  const iconStyle =
    customImage || isShell
      ? "border-white/10 bg-white"
      : (transactionIconStyles[iconKey as keyof typeof transactionIconStyles] ??
        transactionIconStyles.default);
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border shadow-sm ${iconStyle}`}
      >
        {customImage ? (
          <Image
            src={customImage}
            width={32}
            height={32}
            alt=""
            className="size-full object-cover"
          />
        ) : isShell ? (
          <Image
            src="/brands/shell.png"
            width={24}
            height={24}
            alt="Shell"
            className="size-6 object-contain"
          />
        ) : (
          <Icon className="size-4" strokeWidth={2.2} />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium">{transaction.description}</p>
        <p className="text-xs text-muted-foreground">
          {category?.name ?? transaction.categoryName ?? "Sem categoria"}
        </p>
      </div>
    </div>
  );
}
function TransactionTable({
  transactions,
  categories = [],
  all = false,
}: {
  transactions: Tx[];
  categories?: Category[];
  all?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [importing, setImporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => {
    const source = all ? transactions : transactions.slice(0, 8);
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const min = minimum ? Number(minimum) * 100 : 0;
    const max = maximum ? Number(maximum) * 100 : Number.POSITIVE_INFINITY;
    return source.filter(
      (t) =>
        (kind === "all" || t.type === kind) &&
        (!term || t.description.toLocaleLowerCase("pt-BR").includes(term)) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        t.amountCents >= min &&
        t.amountCents <= max,
    );
  }, [all, from, kind, maximum, minimum, query, to, transactions]);
  async function remove(transaction: Tx) {
    if (
      !window.confirm(
        `Excluir “${transaction.description}”? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    try {
      await deleteTransaction(transaction.id);
      toast.success("Lançamento excluído.");
    } catch {
      toast.error("Não foi possível excluir o lançamento.");
    }
  }
  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const lines = [
      ["Descrição", "Data", "Tipo", "Valor"],
      ...rows.map((t) => [
        t.description,
        t.date,
        t.type === "income" ? "Receita" : "Despesa",
        (t.amountCents / 100).toFixed(2).replace(".", ","),
      ]),
    ].map((line) => line.map((value) => escape(String(value))).join(";"));
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${lines.join("\n")}`], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `clareza-transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo CSV exportado.");
  }
  async function exportExcel() {
    const XLSX = await import("xlsx");
    const data = rows.map((t) => ({
      Descrição: t.description,
      Data: t.date,
      Tipo: t.type === "income" ? "Receita" : "Despesa",
      Valor: t.amountCents / 100,
      Categoria:
        categories.find((c) => c.id === t.categoryId)?.name ??
        t.categoryName ??
        "",
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(data),
      "Transações",
    );
    XLSX.writeFile(
      book,
      `clareza-transacoes-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }
  async function importFile(file: File) {
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
        raw: true,
      });
      const sheet = book.Sheets[book.SheetNames[0]];
      if (!sheet) throw new Error("A planilha está vazia");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      const key = (value: string) =>
        repairImportedText(value)
          .replace(/^\uFEFF/, "")
          .replace(/^"|"$/g, "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
      const value = (row: Record<string, unknown>, names: string[]) => {
        const found = Object.keys(row).find((column) =>
          names.includes(key(column)),
        );
        return found ? row[found] : "";
      };
      const parsed = raw.map((row, index) => {
        const description = repairImportedText(
          String(value(row, ["descricao", "description"])),
        ).trim();
        const typeText = key(String(value(row, ["tipo", "type"])));
        const type =
          typeText === "receita" ||
          typeText === "income" ||
          typeText === "entrada"
            ? "income"
            : typeText === "despesa" ||
                typeText === "expense" ||
                typeText === "saida"
              ? "expense"
              : null;
        const rawDate = value(row, ["data", "date"]);
        const date =
          rawDate instanceof Date
            ? rawDate.toISOString().slice(0, 10)
            : String(rawDate).trim().split("/").reverse().join("-");
        const rawAmount = String(value(row, ["valor", "amount"])).replace(
          /[^\d,.-]/g,
          "",
        );
        const amount = Number(
          rawAmount.includes(",")
            ? rawAmount.replaceAll(".", "").replace(",", ".")
            : rawAmount,
        );
        if (
          !description ||
          !type ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(amount) ||
          amount === 0
        )
          throw new Error(
            `Linha ${index + 2} inválida. Verifique Descrição, Data, Tipo e Valor.`,
          );
        return {
          description,
          type,
          date,
          amountCents: Math.round(Math.abs(amount) * 100),
          categoryName:
            repairImportedText(
              String(value(row, ["categoria", "category"])),
            ).trim() || undefined,
        };
      });
      const result = await importTransactions(parsed);
      toast.success(`${result.count} transações importadas.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível importar o arquivo.",
      );
    } finally {
      setImporting(false);
      if (importInput.current) importInput.current.value = "";
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {all ? "Todos os lançamentos" : "Transações recentes"}
        </CardTitle>
        <CardDescription>
          {all
            ? "Histórico completo das suas movimentações"
            : "Seus últimos lançamentos"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {all && (
          <>
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <input
                ref={importInput}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => importInput.current?.click()}
                disabled={importing}
              >
                <Upload data-icon="inline-start" />
                {importing ? "Importando…" : "Importar CSV/Excel"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!rows.length}
              >
                <Download data-icon="inline-start" />
                CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void exportExcel()}
                disabled={!rows.length}
              >
                <FileSpreadsheet data-icon="inline-start" />
                Excel
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-4 w-full justify-between sm:hidden"
              aria-expanded={filtersOpen}
              aria-controls="transaction-filters"
              onClick={() => setFiltersOpen((value) => !value)}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="size-4" />
                {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
              </span>
              {(query || kind !== "all" || from || to || minimum || maximum) && (
                <span className="size-2 rounded-full bg-primary" />
              )}
            </Button>
            <div
              id="transaction-filters"
              className={`${filtersOpen ? "grid" : "hidden"} mb-4 gap-3 sm:grid lg:grid-cols-6`}
            >
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar descrição"
                  className="pl-9"
                  aria-label="Buscar transações"
                />
              </div>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-3 text-sm"
                aria-label="Filtrar por tipo"
              >
                <option value="all">Todos os tipos</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
              </select>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="Data inicial"
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="Data final"
              />
              <Input
                type="number"
                min="0"
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
                placeholder="Valor mínimo"
              />
              <Input
                type="number"
                min="0"
                value={maximum}
                onChange={(e) => setMaximum(e.target.value)}
                placeholder="Valor máximo"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setKind("all");
                  setFrom("");
                  setTo("");
                  setMinimum("");
                  setMaximum("");
                  setFiltersOpen(false);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </>
        )}
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <TransactionLabel transaction={t} categories={categories} />
                  </TableCell>
                  <TableCell>
                    {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={t.type === "income" ? "default" : "secondary"}
                    >
                      {t.type === "income" ? "Receita" : "Despesa"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-semibold ${t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {t.type === "expense" ? "−" : "+"}
                    {brl(t.amountCents)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <EditTransactionDialog
                        transaction={t}
                        categories={categories}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Excluir ${t.description}`}
                        onClick={() => remove(t)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty
            text={
              query || kind !== "all" || from || to || minimum || maximum
                ? "Nenhum lançamento encontrado com esses filtros."
                : "Adicione seu primeiro lançamento para começar."
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
function Quotes({ quotes }: { quotes: Quote[] }) {
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
function MarketMetricRow({ quote: q }: { quote: Quote }) {
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
function Insights({
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
