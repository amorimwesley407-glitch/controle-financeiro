"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChartColumn, CreditCard, LayoutDashboard, Lightbulb, LogOut, Menu, ReceiptText, Settings2, Target, TrendingUp, UserRound, WalletCards } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { FinancialGoalsOrbit } from "@/components/financial-goals-orbit";
import { LocationTag } from "@/components/ui/location-tag";
import { GoalsFeatureCard } from "@/components/goals-feature-card";
import { Account, Budget, Category, GoalType, HideValueButton, Holding, Transfer, Tx, setAllMoneyHidden, useHiddenValue, useStoredFlag } from "@/components/finance/shared";
import { getPurchaseDueDate } from "@/lib/accounts";
import { CardBillsCard } from "@/components/finance/card-bills";
import { BillsCard } from "@/components/finance/bills-card";
import { AccountsView } from "@/components/finance/accounts-view";
import { FormDialog } from "@/components/finance/form-dialog";
import { TransactionTable } from "@/components/finance/transactions";
import { CategoriesView } from "@/components/finance/categories-view";
import { InvestmentsView } from "@/components/finance/investments-view";
import { InvestmentGuideView } from "@/components/finance/investment-guide-view";
import { PlanningView } from "@/components/finance/planning-view";
import { FixedExpensesCard } from "@/components/finance/fixed-expenses";
import { ToolsView } from "@/components/finance/tools-view";
import { ReportsView } from "@/components/finance/reports-view";
import { DashboardView, Insights } from "@/components/finance/dashboard-view";
import { SettingsView } from "@/components/finance/settings-view";
import { AccountMenu, Nav, NotificationMenu } from "@/components/finance/navigation";

type Props = {
  currentDate: string;
  user: { name: string; email: string; image: string | null };
  transactions: Tx[];
  categories: Category[];
  goals: GoalType[];
  budgets: Budget[];
  holdings: Holding[];
  accounts: Account[];
  transfers: Transfer[];
};
type View =
  | "dashboard"
  | "reports"
  | "tools"
  | "transactions"
  | "accounts"
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
  accounts,
  transfers,
}: Props) {
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [allHidden, toggleAllHidden] = useHiddenValue("todos");
  setAllMoneyHidden(allHidden);
  const [view, setView] = useState<View>("dashboard");
  const [displayName, setDisplayName] = useState(user.name);
  const [displayImage, setDisplayImage] = useState(user.image);
  const [cardsByDueDate, setCardsByDueDate] = useStoredFlag("clareza:painel:cartao-no-vencimento");
  const cards = useMemo(
    () => accounts.filter((account) => account.kind === "credit_card" && account.closingDay && account.dueDay),
    [accounts],
  );
  const summary = useMemo(
    () => summarize(transactions, categories, currentDate, (tx) => tx.date),
    [transactions, categories, currentDate],
  );
  // No painel, as compras no cartão podem contar no vencimento da fatura, quando o dinheiro sai da conta.
  const dashboardSummary = useMemo(() => {
    if (!cardsByDueDate || !cards.length) return summary;
    const byId = new Map(cards.map((card) => [card.id, card]));
    return summarize(transactions, categories, currentDate, (tx) => {
      const card = tx.accountId ? byId.get(tx.accountId) : undefined;
      return card ? getPurchaseDueDate(tx.date, card.closingDay!, card.dueDay!) : tx.date;
    });
  }, [cardsByDueDate, cards, summary, transactions, categories, currentDate]);
  const { income, expense, flow, byCategory, savings } = summary;
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
    accounts: ["Contas e cartões", "Acompanhe saldos, faturas e parcelas."],
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
            icon={CreditCard}
            active={view === "accounts"}
            onClick={() => navigate("accounts")}
          >
            Contas e cartões
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
              cards={cards}
              transfers={transfers}
              currentDate={currentDate}
            />
            <HideValueButton all hidden={allHidden} onToggle={toggleAllHidden} />
            <ThemeToggle />
            <FormDialog type="transaction" categories={categories} accounts={accounts} />
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
                income={dashboardSummary.income}
                expense={dashboardSummary.expense}
                balance={dashboardSummary.balance}
                savings={dashboardSummary.savings}
                flow={dashboardSummary.flow}
                byCategory={dashboardSummary.byCategory}
                holdings={holdings}
                bills={<BillsCard transactions={transactions} currentDate={currentDate} />}
              >
                {cards.length > 0 && (
                  <CardBillsCard
                    cards={cards}
                    accounts={accounts}
                    transactions={transactions}
                    transfers={transfers}
                    currentDate={currentDate}
                    byDueDate={cardsByDueDate}
                    onByDueDateChange={setCardsByDueDate}
                  />
                )}
              </DashboardView>
              <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(300px,1fr)_minmax(0,2fr)]">
                <GoalsFeatureCard goals={goals} />
                <TransactionTable
                  transactions={transactions.filter(
                    (transaction) => transaction.date <= currentDate,
                  )}
                  categories={categories}
                  accounts={accounts}
                />
              </div>
              <Insights savings={dashboardSummary.savings} expense={dashboardSummary.expense} income={dashboardSummary.income} />
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
              accounts={accounts}
              holdings={holdings}
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
                <FormDialog type="transaction" categories={categories} accounts={accounts} />
              </div>
              <TransactionTable
                transactions={transactions.filter(
                  (transaction) =>
                    transaction.date.slice(0, 7) <= currentDate.slice(0, 7),
                )}
                categories={categories}
                accounts={accounts}
                all
              />
            </section>
          )}
          {view === "accounts" && (
            <AccountsView
              accounts={accounts}
              transfers={transfers}
              transactions={transactions}
              currentDate={currentDate}
            />
          )}
          {view === "planning" && (
            <div className="flex flex-col gap-6">
              <FinancialGoalsOrbit goals={goals} />
              <FixedExpensesCard transactions={transactions} currentDate={currentDate} />
              <PlanningView
                currentDate={currentDate}
                accounts={accounts}
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

/**
 * Totais até hoje e os últimos seis meses, usando `dateOf` como a data em que cada lançamento conta.
 * Lançamentos com essa data no futuro ainda não entram.
 */
function summarize(transactions: Tx[], categories: Category[], currentDate: string, dateOf: (tx: Tx) => string) {
  const now = new Date();
  const flow = Array.from({ length: 6 }, (_, offset) => {
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
  const lookup = new Map(flow.map((item) => [item.key, item]));
  const totals = new Map<number, number>();
  let income = 0,
    expense = 0;
  for (const tx of transactions) {
    const date = dateOf(tx);
    if (date > currentDate) continue;
    if (tx.type === "income") income += tx.amountCents;
    else if (tx.type === "expense") {
      expense += tx.amountCents;
      if (tx.categoryId)
        totals.set(
          tx.categoryId,
          (totals.get(tx.categoryId) ?? 0) + tx.amountCents,
        );
    }
    const bucket = lookup.get(date.slice(0, 7));
    if (bucket) {
      if (tx.type === "income") bucket.receitas += tx.amountCents / 100;
      else bucket.despesas += tx.amountCents / 100;
      bucket.saldo = bucket.receitas - bucket.despesas;
    }
  }
  const byCategory = categories
    .map((c, i) => ({
      name: c.name,
      value: (totals.get(c.id) ?? 0) / 100,
      fill: `var(--chart-${(i % 3) + 1})`,
    }))
    .filter((x) => x.value > 0);
  const balance = income - expense;
  const savings = income ? Math.round((balance / income) * 100) : 0;
  return { income, expense, balance, savings, flow, byCategory };
}
