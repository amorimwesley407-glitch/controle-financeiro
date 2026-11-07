"use client";

import { useTransition } from "react";
import { Check, Undo2 } from "lucide-react";
import { setBillPaid } from "@/app/actions/finance";
import { getPendingBills } from "@/lib/finance";
import { Badge } from "@/components/ui/badge";
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

function BillItem({ bill, daysLeft }: { bill: Tx; daysLeft: number | null }) {
  const [pending, startTransition] = useTransition();
  const paid = bill.billStatus === "paid";
  function toggle() {
    startTransition(async () => {
      try {
        await setBillPaid(bill.id, !paid);
        toast.success(paid ? "A conta voltou para pendente." : "Conta marcada como paga.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a conta.");
      }
    });
  }
  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${paid ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium" title={bill.description}>{bill.description}</p>
        <p className="shrink-0 font-mono text-sm font-semibold">{brl(bill.amountCents)}</p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        {paid ? (
          <Badge variant="secondary">Paga</Badge>
        ) : (
          <p className={`text-xs ${daysLeft !== null && daysLeft <= 3 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
            {dueText(bill.date, daysLeft ?? 0)}
          </p>
        )}
        <Button variant={paid ? "ghost" : "outline"} size="sm" onClick={toggle} disabled={pending} className="shrink-0">
          {paid ? <Undo2 data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          {paid ? "Desfazer" : "Paga"}
        </Button>
      </div>
    </div>
  );
}

/** Contas a pagar vencidas e dos próximos 30 dias, mais as já pagas no mês. Some quando não há nenhuma. */
export function BillsCard({ transactions, currentDate }: { transactions: Tx[]; currentDate: string }) {
  const pending = getPendingBills(transactions, currentDate, 30);
  const currentMonth = currentDate.slice(0, 7);
  const paid = transactions
    .filter((item) => item.billStatus === "paid" && item.date.startsWith(currentMonth))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!pending.length && !paid.length) return null;
  const total = pending.reduce((sum, item) => sum + item.amountCents, 0);
  const overdue = pending.filter((item) => item.daysLeft < 0).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas a pagar</CardTitle>
        <CardDescription className="mt-1">
          {pending.length
            ? `${brl(total)} pendentes nos próximos 30 dias${overdue ? `, ${overdue} ${overdue === 1 ? "vencida" : "vencidas"}` : ""}.`
            : "Tudo pago por enquanto."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pending.map((bill) => (
          <BillItem key={bill.id} bill={bill} daysLeft={bill.daysLeft} />
        ))}
        {paid.map((bill) => (
          <BillItem key={bill.id} bill={bill} daysLeft={null} />
        ))}
      </CardContent>
    </Card>
  );
}
