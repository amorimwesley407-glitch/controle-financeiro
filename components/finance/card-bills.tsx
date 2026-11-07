"use client";

import { CARD_COLORS, INVOICE_STATUS_LABELS, daysBetween, getCardColor, getCardInvoices, getCardLimitUsed, getCurrentInvoice } from "@/lib/accounts";
import { TransferDialog } from "@/components/finance/accounts-view";
import { CardLimitBar } from "@/components/finance/credit-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Account, Transfer, Tx, brl } from "@/components/finance/shared";

const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const plural = (days: number) => `${days} ${days === 1 ? "dia" : "dias"}`;

type Invoice = ReturnType<typeof getCardInvoices<Tx>>[number];

function dueText(invoice: Invoice, currentDate: string) {
  const days = daysBetween(currentDate, invoice.dueDate);
  if (invoice.status === "open") return `Fecha em ${formatDate(invoice.closingDate)} e vence em ${formatDate(invoice.dueDate)}`;
  if (days < 0) return `Venceu em ${formatDate(invoice.dueDate)}, há ${plural(-days)}`;
  if (days === 0) return "Vence hoje";
  return `Vence em ${formatDate(invoice.dueDate)}, daqui a ${plural(days)}`;
}

function CardBill({ card, accounts, transactions, transfers, currentDate }: {
  card: Account;
  accounts: Account[];
  transactions: Tx[];
  transfers: Transfer[];
  currentDate: string;
}) {
  const invoice = getCurrentInvoice(getCardInvoices(card, transactions, transfers, currentDate));
  const color = CARD_COLORS[getCardColor(card.cardColor, card.name)];
  const urgent = invoice && invoice.status !== "open" && daysBetween(currentDate, invoice.dueDate) <= 3;
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="h-4 w-6 shrink-0 rounded-[4px]" style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }} />
          <span className="truncate">{card.name}</span>
        </span>
        {invoice && (
          <Badge variant={invoice.status === "overdue" ? "destructive" : "outline"} className="shrink-0">
            {INVOICE_STATUS_LABELS[invoice.status]}
          </Badge>
        )}
      </div>
      {invoice ? (
        <div>
          <p className="font-mono text-2xl font-semibold tracking-tight">{brl(invoice.remainingCents)}</p>
          <p className={`mt-1 text-xs ${urgent ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
            {dueText(invoice, currentDate)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma fatura em aberto.</p>
      )}
      {card.creditLimitCents ? (
        <CardLimitBar usedCents={getCardLimitUsed(card, transactions, transfers, currentDate)} limitCents={card.creditLimitCents} />
      ) : null}
      {invoice && invoice.remainingCents > 0 && (
        <div className="mt-auto flex justify-end">
          <TransferDialog
            accounts={accounts}
            currentDate={currentDate}
            toAccountId={card.id}
            amountCents={invoice.remainingCents}
            label="Pagar fatura"
            description={`Fatura ${card.name}`}
          />
        </div>
      )}
    </div>
  );
}

/** Fatura atual de cada cartão, com o limite e a escolha de quando as compras no cartão contam no painel. */
export function CardBillsCard({ cards, accounts, transactions, transfers, currentDate, byDueDate, onByDueDateChange }: {
  cards: Account[];
  accounts: Account[];
  transactions: Tx[];
  transfers: Transfer[];
  currentDate: string;
  byDueDate: boolean;
  onByDueDateChange: (value: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Faturas dos cartões</CardTitle>
          <CardDescription className="mt-1">
            {byDueDate
              ? "O painel conta as compras no cartão no dia em que a fatura vence."
              : "O painel conta as compras no cartão na data da compra."}
          </CardDescription>
        </div>
        <label className="flex shrink-0 flex-col gap-1 text-xs text-muted-foreground">
          Contar gastos do cartão
          <Select value={byDueDate ? "due" : "purchase"} onValueChange={(value) => onByDueDateChange(value === "due")}>
            <SelectTrigger size="sm" className="w-full sm:w-52" aria-label="Contar gastos do cartão">
              <SelectValue>{(value: string) => (value === "due" ? "No vencimento da fatura" : "Na data da compra")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="purchase">Na data da compra</SelectItem>
                <SelectItem value="due">No vencimento da fatura</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <CardBill key={card.id} card={card} accounts={accounts} transactions={transactions} transfers={transfers} currentDate={currentDate} />
        ))}
      </CardContent>
    </Card>
  );
}
