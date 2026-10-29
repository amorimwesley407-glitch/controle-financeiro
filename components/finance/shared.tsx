"use client";

import { BriefcaseBusiness, BusFront, Car, CreditCard, Dumbbell, Gamepad2, Gift, GraduationCap, HeartPulse, House, PawPrint, Pill, Scissors, ShieldCheck, ShoppingBag, Target, Tv, Utensils, WalletCards, Wifi } from "lucide-react";
import { CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { type ChartConfig } from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { AnimatedCard } from "@/components/ui/animated-card";

export type Tx = {
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

export type Category = {
  id: number;
  name: string;
  type: string;
  color: string;
  icon: string;
  imagePath?: string | null;
};

export type GoalType = {
  id: number;
  name: string;
  targetCents: number;
  currentCents: number;
  deadline: string | null;
};

export type Budget = { id: number; name: string; limitCents: number; month: string; categoryId: number | null };

export type Holding = {
  id: number;
  symbol: string;
  assetType: string;
  quantity: string;
  averageCostCents: number;
  applicationDate?: string | null;
};

export type Quote = {
  symbol: string;
  name: string;
  value: number;
  change: number;
  kind: string;
};

export type StockQuote = {
  symbol: string;
  name: string;
  logoUrl?: string;
  price: number;
  change: number;
  updatedAt: string | null;
};

export type HistoricalPoint = { date: number; value: number };

export type HistoryRange = "7d" | "1mo" | "6mo" | "1y";

export const brl = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    c / 100,
  );

export const chartConfig = {
  receitas: { label: "Receitas", color: "var(--chart-1)" },
  despesas: { label: "Despesas", color: "var(--chart-2)" },
  saldo: { label: "Saldo", color: "var(--chart-3)" },
} satisfies ChartConfig;

export const categoryIcons = {
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

export const transactionIconStyles = {
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

export const categoryIconOptions = [
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

export const streamingServices = [
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

export const streamingServiceImages: Partial<
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

export function getStreamingServiceImage(description: string) {
  return streamingServiceImages[
    description as (typeof streamingServices)[number]
  ];
}

export function isStreamingCategory(category?: Category) {
  return Boolean(
    category &&
      (category.icon === "streaming" ||
        category.name.trim().toLocaleLowerCase("pt-BR").includes("streaming")),
  );
}

export const investmentOptions = {
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

export const isFixedIncomeType = (type: string) =>
  type === "cdb" || type === "treasury";

export const repairImportedText = (text: string) => {
  if (!/[ÃÂâ]/.test(text)) return text;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from([...text].map((character) => character.charCodeAt(0))),
    );
  } catch {
    return text;
  }
};

export function Field({
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

export function Metric({
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

export function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
