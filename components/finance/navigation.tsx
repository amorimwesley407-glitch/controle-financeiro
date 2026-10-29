"use client";

import { useState } from "react";
import { getBudgetAlerts } from "@/lib/finance";
import { Bell, CreditCard, LogOut, ReceiptText, Settings2, Target, TriangleAlert, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AnimatedList } from "@/components/ui/animated-list";
import { Budget, Category, Tx, brl } from "@/components/finance/shared";

export function NotificationMenu({
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

export function AccountMenu({
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

export function AccountMenuItem({
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

export function Nav({
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
