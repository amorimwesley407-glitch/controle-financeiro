import { CARD_COLORS, getCardColor } from "@/lib/accounts";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/components/finance/shared";

function BrandMark({ brand, color }: { brand?: string | null; color: string }) {
  if (brand === "mastercard")
    return (
      <svg viewBox="0 0 48 30" className="h-8 w-auto" role="img" aria-label="Mastercard">
        <circle cx="15" cy="15" r="15" fill="#EB001B" />
        <circle cx="33" cy="15" r="15" fill="#F79E1B" />
        <path d="M24 3a15 15 0 0 1 0 24 15 15 0 0 1 0-24Z" fill="#FF5F00" />
      </svg>
    );
  if (brand === "visa") return <span style={{ color }} className="text-2xl font-extrabold italic tracking-tight">VISA</span>;
  if (brand === "elo") return <span style={{ color }} className="text-2xl font-bold lowercase tracking-tight">elo</span>;
  if (brand === "amex") return <span className="rounded-sm bg-[#2E77BC] px-1.5 py-1 text-[10px] font-extrabold leading-none text-white">AMERICAN<br />EXPRESS</span>;
  if (brand === "hipercard") return <span className="rounded-md bg-[#B3131B] px-2 py-1 text-xs font-bold italic text-white">Hipercard</span>;
  return null;
}

/** Desenho do cartão. Mostra só os 4 últimos dígitos: o app nunca guarda o número completo. */
export function CreditCardVisual({ name, brand, color, lastDigits }: {
  name: string;
  brand?: string | null;
  color?: string | null;
  lastDigits?: string | null;
}) {
  const style = CARD_COLORS[getCardColor(color, name)];
  return (
    <div
      className="relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-2xl p-5 shadow-lg"
      style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})`, color: style.text }}
    >
      <span className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-white/10" aria-hidden />
      <span className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-black/10" aria-hidden />
      <p className="relative truncate text-lg font-semibold">{name || "Meu cartão"}</p>
      <div className="relative flex items-center gap-3">
        <span className="grid h-8 w-11 grid-cols-3 gap-px overflow-hidden rounded-md bg-gradient-to-br from-amber-200 to-amber-500 p-1" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => <span key={index} className="rounded-[1px] border border-amber-700/40" />)}
        </span>
        <svg viewBox="0 0 24 24" className="size-5 rotate-90 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 15a6 6 0 0 1 12 0M9 17a3 3 0 0 1 6 0M3 12a9 9 0 0 1 18 0" />
        </svg>
      </div>
      <div className="relative flex items-center justify-between gap-2">
        <p className="min-w-0 whitespace-nowrap font-mono text-xs tracking-wider">•••• •••• •••• {lastDigits || "••••"}</p>
        <BrandMark brand={brand} color={style.text} />
      </div>
    </div>
  );
}

/** Barra do limite usado. Acima do limite, a barra fica cheia e vermelha. */
export function CardLimitBar({ usedCents, limitCents, className }: { usedCents: number; limitCents: number; className?: string }) {
  const percentage = Math.round((usedCents / limitCents) * 100);
  const over = usedCents > limitCents;
  return (
    <div className={`flex flex-col gap-1.5 text-xs ${className ?? ""}`}>
      {/* Em cards estreitos, o valor desce inteiro para a linha de baixo em vez de quebrar no meio. */}
      <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
        <span className="whitespace-nowrap text-muted-foreground">Limite usado</span>
        <span className="whitespace-nowrap font-mono">
          {brl(usedCents)} de {brl(limitCents)}
        </span>
      </div>
      <Progress
        value={Math.min(percentage, 100)}
        aria-label="Limite usado"
        className={over ? "[&_[data-slot=progress-indicator]]:bg-red-500" : percentage >= 80 ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : undefined}
      />
      <span className={over ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
        {over ? `Acima do limite em ${brl(usedCents - limitCents)}` : `Disponível: ${brl(limitCents - usedCents)}`}
      </span>
    </div>
  );
}
