"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBudgetAlerts } from "@/lib/finance";
import { Bell, CalendarDays, ChartColumn, CreditCard, LayoutDashboard, Lightbulb, LogOut, Menu, ReceiptText, Settings2, Target, TrendingUp, TriangleAlert, UserRound, WalletCards } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { FinancialGoalsOrbit } from "@/components/financial-goals-orbit";
import { AnimatedList } from "@/components/ui/animated-list";
import { LocationTag } from "@/components/ui/location-tag";
import { GoalsFeatureCard } from "@/components/goals-feature-card";
import { Budget, Category, GoalType, Holding, Tx, brl } from "@/components/finance/shared";
import { FormDialog } from "@/components/finance/form-dialog";
import { TransactionTable } from "@/components/finance/transactions";
import { CategoriesView } from "@/components/finance/categories-view";
import { InvestmentsView } from "@/components/finance/investments-view";
import { InvestmentGuideView } from "@/components/finance/investment-guide-view";
import { PlanningView } from "@/components/finance/planning-view";
import { ToolsView } from "@/components/finance/tools-view";
import { ReportsView } from "@/components/finance/reports-view";
import { DashboardView, Insights } from "@/components/finance/dashboard-view";
import { SettingsView } from "@/components/finance/settings-view";

type Props = {
  currentDate: string;
  user: { name: string; email: string; image: string | null };
  transactions: Tx[];
  categories: Category[];
  goals: GoalType[];
  budgets: Budget[];
  holdings: Holding[];
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
export function FinanceDashboard({
  currentDate,
  user,
  transactions,
  categories,
  goals,
  budgets,
  holdings,
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
            <InvestmentsView holdings={holdings} categories={categories} />
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
