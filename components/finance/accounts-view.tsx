"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, CreditCard, Landmark, Pencil, PiggyBank, Plus, Trash2, Wallet } from "lucide-react";
import { addAccount, addTransfer, deleteAccount, deleteTransfer, updateAccount } from "@/app/actions/finance";
import { getAccountBalance, getCardInvoices, type InvoiceStatus } from "@/lib/accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Account, Empty, Field, Transfer, Tx, brl } from "@/components/finance/shared";

const kinds = {
  checking: { label: "Conta corrente", icon: Landmark },
  savings: { label: "Poupança", icon: PiggyBank },
  cash: { label: "Dinheiro", icon: Wallet },
  credit_card: { label: "Cartão de crédito", icon: CreditCard },
};
const statusLabels: Record<InvoiceStatus, string> = {
  paid: "Paga",
  overdue: "Vencida",
  closed: "Fechada",
  open: "Aberta",
  future: "Próxima",
};
const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
const kindOf = (kind: string) => kinds[kind as keyof typeof kinds] ?? kinds.checking;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível salvar.";
}

function AccountDialog({ account }: { account?: Account }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(account?.kind ?? "checking");
  const [pending, startTransition] = useTransition();
  const isCard = kind === "credit_card";
  const initialValue = account ? Math.abs(account.initialBalanceCents) / 100 : 0;
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        if (account) await updateAccount(account.id, form);
        else await addAccount(form);
        setOpen(false);
        toast.success(account ? "Conta atualizada." : "Conta criada.");
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          account ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${account.name}`} />
          ) : (
            <Button size="sm" />
          )
        }
      >
        {account ? <Pencil /> : <><Plus data-icon="inline-start" />Nova conta</>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>Cadastre uma conta bancária, carteira ou cartão de crédito.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" defaultValue={account?.name} placeholder="Ex.: Nubank" required />
          </Field>
          <Field label="Tipo">
            <Select name="kind" value={kind} onValueChange={(value) => setKind(String(value))}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => kindOf(value).label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.entries(kinds).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {isCard && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Dia do fechamento">
                <Input name="closingDay" type="number" min="1" max="31" defaultValue={account?.closingDay ?? undefined} required />
              </Field>
              <Field label="Dia do vencimento">
                <Input name="dueDay" type="number" min="1" max="31" defaultValue={account?.dueDay ?? undefined} required />
              </Field>
            </div>
          )}
          <Field label={isCard ? "Dívida atual, fora dos lançamentos" : "Saldo inicial"}>
            <Input
              name="initialBalance"
              type="number"
              step="0.01"
              min={isCard ? "0" : undefined}
              defaultValue={account ? (isCard ? initialValue : account.initialBalanceCents / 100) : ""}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              {isCard
                ? "Use só para o que já está na fatura e não será lançado aqui."
                : "Quanto havia na conta antes do primeiro lançamento vinculado a ela."}
            </p>
          </Field>
          <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountSelect({ name, label, accounts, defaultValue }: { name: string; label: string; accounts: Account[]; defaultValue?: string }) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue={defaultValue} required>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecionar">
            {(value: string | null) => accounts.find((account) => String(account.id) === value)?.name ?? "Selecionar"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function TransferDialog({ accounts, currentDate, toAccountId, amountCents, label = "Nova transferência", description = "" }: {
  accounts: Account[];
  currentDate: string;
  toAccountId?: number;
  amountCents?: number;
  label?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        await addTransfer(form);
        setOpen(false);
        toast.success("Transferência registrada.");
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ArrowRightLeft data-icon="inline-start" />
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>Move dinheiro entre contas. Não conta como receita nem como despesa.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <AccountSelect name="fromAccountId" label="De" accounts={accounts.filter((account) => account.id !== toAccountId)} />
            <AccountSelect name="toAccountId" label="Para" accounts={accounts} defaultValue={toAccountId ? String(toAccountId) : undefined} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor">
              <Input name="amount" type="number" min="0.01" step="0.01" defaultValue={amountCents ? (amountCents / 100).toFixed(2) : undefined} required />
            </Field>
            <Field label="Data">
              <Input name="date" type="date" defaultValue={currentDate} required />
            </Field>
          </div>
          <Field label="Descrição (opcional)">
            <Input name="description" defaultValue={description} maxLength={80} />
          </Field>
          <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CardInvoices({ card, accounts, transactions, transfers, currentDate }: {
  card: Account;
  accounts: Account[];
  transactions: Tx[];
  transfers: Transfer[];
  currentDate: string;
}) {
  const invoices = useMemo(() => getCardInvoices(card, transactions, transfers, currentDate), [card, transactions, transfers, currentDate]);
  // Mostra o que ainda exige atenção, a fatura aberta e as próximas; as já pagas ficam só nas duas mais recentes.
  const pending = invoices.filter((invoice) => invoice.status !== "paid");
  const paid = invoices.filter((invoice) => invoice.status === "paid").slice(-2);
  const visible = [...paid, ...pending].slice(0, 8);
  const futureCents = invoices.filter((invoice) => invoice.status === "future").reduce((sum, invoice) => sum + invoice.totalCents, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturas de {card.name}</CardTitle>
        <CardDescription>
          Fecha no dia {card.closingDay} e vence no dia {card.dueDay}. Já comprometido nas próximas faturas: {brl(futureCents)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {visible.length ? visible.map((invoice) => (
          <details key={invoice.closingDate} className="rounded-lg border p-3">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <Badge variant={invoice.status === "overdue" ? "destructive" : invoice.status === "paid" ? "secondary" : "outline"}>
                  {statusLabels[invoice.status]}
                </Badge>
                Vence em {formatDate(invoice.dueDate)}
              </span>
              <span className="font-mono font-semibold">
                {brl(invoice.totalCents)}
                {invoice.paidCents > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {invoice.remainingCents > 0 ? `faltam ${brl(invoice.remainingCents)}` : "quitada"}
                  </span>
                )}
              </span>
            </summary>
            <ul className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
              {invoice.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {formatDate(item.date)} · {item.description}
                    {item.installmentTotal ? ` (${item.installmentNumber}/${item.installmentTotal})` : ""}
                  </span>
                  <span className="shrink-0 font-mono">{item.type === "income" ? "−" : ""}{brl(item.amountCents)}</span>
                </li>
              ))}
            </ul>
            {invoice.remainingCents > 0 && invoice.status !== "future" && (
              <div className="mt-3 flex justify-end">
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
          </details>
        )) : <Empty text="Nenhuma compra lançada neste cartão." />}
      </CardContent>
    </Card>
  );
}

export function AccountsView({ accounts, transfers, transactions, currentDate }: {
  accounts: Account[];
  transfers: Transfer[];
  transactions: Tx[];
  currentDate: string;
}) {
  const balances = useMemo(
    () => new Map(accounts.map((account) => [account.id, getAccountBalance(account, transactions, transfers, currentDate)])),
    [accounts, transactions, transfers, currentDate],
  );
  const cards = accounts.filter((account) => account.kind === "credit_card");
  const sumOf = (items: Account[]) => items.reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0);
  const available = sumOf(accounts.filter((account) => account.kind !== "credit_card"));
  const cardBalance = sumOf(cards);
  const withoutAccount = transactions.filter((item) => !item.accountId && item.date <= currentDate).length;
  const nameOf = (id: number) => accounts.find((account) => account.id === id)?.name ?? "Conta";
  async function removeAccount(account: Account) {
    if (!window.confirm(`Excluir “${account.name}”? Os lançamentos continuam existindo, mas ficam sem conta.`)) return;
    try {
      await deleteAccount(account.id);
      toast.success("Conta excluída.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  async function removeTransfer(transfer: Transfer) {
    if (!window.confirm("Excluir esta transferência? Os saldos das duas contas serão recalculados.")) return;
    try {
      await deleteTransfer(transfer.id);
      toast.success("Transferência excluída.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Disponível nas contas</p>
            <p className="font-mono text-2xl font-semibold">{brl(available)}</p>
          </div>
          {cards.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Dívida nos cartões</p>
              <p className="font-mono text-2xl font-semibold">{brl(Math.max(-cardBalance, 0))}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {accounts.length >= 2 && <TransferDialog accounts={accounts} currentDate={currentDate} />}
          <AccountDialog />
        </div>
      </div>
      {accounts.length > 0 && withoutAccount > 0 && (
        <p className="text-sm text-muted-foreground">
          {withoutAccount} {withoutAccount === 1 ? "lançamento não tem conta e não entra" : "lançamentos não têm conta e não entram"} nesses saldos. Para incluir, edite o lançamento e escolha a conta.
        </p>
      )}
      {accounts.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const { label, icon: Icon } = kindOf(account.kind);
            const balance = balances.get(account.id) ?? 0;
            return (
              <Card key={account.id}>
                <CardContent className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{account.name}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                    <p className={`mt-3 font-mono text-xl font-semibold ${balance < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{brl(balance)}</p>
                  </div>
                  <div className="flex shrink-0">
                    <AccountDialog account={account} />
                    <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${account.name}`} onClick={() => removeAccount(account)}>
                      <Trash2 />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent>
            <Empty text="Cadastre sua primeira conta ou cartão para acompanhar saldos e faturas." />
          </CardContent>
        </Card>
      )}
      {cards.map((card) => (
        <CardInvoices key={card.id} card={card} accounts={accounts} transactions={transactions} transfers={transfers} currentDate={currentDate} />
      ))}
      {transfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transferências e pagamentos</CardTitle>
            <CardDescription>As 20 mais recentes</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {transfers.slice(0, 20).map((transfer) => (
              <div key={transfer.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{nameOf(transfer.fromAccountId)} → {nameOf(transfer.toAccountId)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(transfer.date)}{transfer.description ? ` · ${transfer.description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono font-semibold">{brl(transfer.amountCents)}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Excluir transferência" onClick={() => removeTransfer(transfer)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
