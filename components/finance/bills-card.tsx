"use client";

import { useTransition } from "react";
import { Check, CircleCheck, Undo2 } from "lucide-react";
import { setBillPaid } from "@/app/actions/finance";
import { getPendingBills } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tx, brl } from "@/components/finance/shared";

const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const plural = (days: number) => `${days} ${days === 1 ? "dia" : "dias"}`;

function dueText(date: string, daysLeft: number) {
  if (daysLeft < 0) return `Venceu em ${formatDate(date)}, há ${plural(-daysLeft)}`;
  if (daysLeft === 0) return "Vence hoje";
  return `Vence em ${formatDate(date)}, daqui a ${plural(daysLeft)}`;
}

/**
 * Marca uma conta a pagar como paga, ou desfaz. Usado no card do painel, no sino e na lista de transações.
 * `compact` mostra só o ícone, para caber em linhas apertadas.
 */
export function BillPaidButton({ bill, undo = false, compact = false }: { bill: Pick<Tx, "id" | "description">; undo?: boolean; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  function toggle() {
    startTransition(async () => {
      try {
        await setBillPaid(bill.id, !undo);
        toast.success(undo ? `“${bill.description}” voltou para Falta pagar.` : `“${bill.description}” marcada como paga.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a conta.");
      }
    });
  }
  const label = undo ? `Desfazer pagamento de ${bill.description}` : `Marcar ${bill.description} como paga`;
  if (undo)
    return (
      <Button variant="ghost" size="icon-sm" onClick={toggle} disabled={pending} aria-label={label} title="Desfazer: voltar para Falta pagar" className="text-muted-foreground">
        <Undo2 />
      </Button>
    );
  return (
    <Button variant="outline" size={compact ? "icon-sm" : "sm"} onClick={toggle} disabled={pending} aria-label={label} title="Marcar como paga" className="shrink-0">
      <Check data-icon={compact ? undefined : "inline-start"} />
      {!compact && "Paga"}
    </Button>
  );
}

/**
 * Contas a pagar em duas partes separadas: o que falta pagar (vencidas e próximos 30 dias)
 * e o que já foi pago no mês, numa lista discreta. O card some quando não há nenhuma.
 */
export function BillsCard({ transactions, currentDate }: { transactions: Tx[]; currentDate: string }) {
  const pending = getPendingBills(transactions, currentDate, 30);
  const currentMonth = currentDate.slice(0, 7);
  const paid = transactions
    .filter((item) => item.billStatus === "paid" && item.date.startsWith(currentMonth))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!pending.length && !paid.length) return null;
  const sum = (items: Tx[]) => items.reduce((total, item) => total + item.amountCents, 0);
  const overdue = pending.filter((item) => item.daysLeft < 0).length;
  const monthName = new Date(`${currentMonth}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas a pagar</CardTitle>
        <CardDescription className="mt-1">
          {pending.length
            ? `Falta pagar ${brl(sum(pending))} nos próximos 30 dias${overdue ? `, ${overdue} ${overdue === 1 ? "vencida" : "vencidas"}` : ""}.`
            : "Tudo pago por enquanto."}
          {paid.length > 0 && ` Já pago em ${monthName}: ${brl(sum(paid))}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {pending.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Falta pagar</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pending.map((bill) => (
                <div key={bill.id} className="flex flex-col gap-3 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium" title={bill.description}>{bill.description}</p>
                    <p className="shrink-0 font-mono text-sm font-semibold">{brl(bill.amountCents)}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <p className={`text-xs ${bill.daysLeft <= 3 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                      {dueText(bill.date, bill.daysLeft)}
                    </p>
                    <BillPaidButton bill={bill} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {paid.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagas em {monthName}</h3>
            <ul className="flex flex-col divide-y rounded-xl border bg-emerald-500/[.04]">
              {paid.map((bill) => (
                <li key={bill.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {bill.description}
                    <span className="hidden text-muted-foreground sm:inline"> · vencimento {formatDate(bill.date)}</span>
                  </span>
                  <span className="shrink-0 font-mono text-muted-foreground">{brl(bill.amountCents)}</span>
                  <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">Paga</span>
                  <BillPaidButton bill={bill} undo />
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
