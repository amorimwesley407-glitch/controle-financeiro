"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getBudgetAlerts, getMonthlyForecast } from "@/lib/finance";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Bell, Calculator, Camera, CalendarDays, ChartColumn, CreditCard, LayoutDashboard, Lightbulb, LockKeyhole, LogOut, Mail, Menu, Palette, ReceiptText, Settings2, ShieldCheck, Target, Trash2, TrendingUp, TriangleAlert, UserRound, WalletCards } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { updateUserProfile } from "@/app/actions/finance";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { FinancialGoalsOrbit } from "@/components/financial-goals-orbit";
import { AnimatedList } from "@/components/ui/animated-list";
import { LocationTag } from "@/components/ui/location-tag";
import { GoalsFeatureCard } from "@/components/goals-feature-card";
import { Budget, Category, Empty, Field, GoalType, Holding, Metric, Tx, brl, chartConfig } from "@/components/finance/shared";
import { FormDialog } from "@/components/finance/form-dialog";
import { TransactionTable } from "@/components/finance/transactions";
import { CategoriesView } from "@/components/finance/categories-view";
import { InvestmentsView } from "@/components/finance/investments-view";
import { InvestmentGuideView } from "@/components/finance/investment-guide-view";
import { PlanningView } from "@/components/finance/planning-view";
import { ToolsView } from "@/components/finance/tools-view";

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
  const {
    isCurrentMonth,
    isFutureMonth,
    monthTransactions,
    futureTransactions,
    pendingIncome,
    pendingExpense,
    projectedBalance,
  } = getMonthlyForecast(transactions, selectedMonth, currentDate);
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
