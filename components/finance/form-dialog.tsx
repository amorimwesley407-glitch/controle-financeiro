"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { addBudget, addCategory, addGoal, addHolding, addTransaction } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Account, Category, Field, Quote, brl, categoryIconOptions, categoryIcons, investmentOptions, isFixedIncomeType, isStreamingCategory, streamingServiceImages, streamingServices } from "@/components/finance/shared";

export function FormDialog({
  type,
  categories,
  quotes = [],
  accounts = [],
}: {
  type: "transaction" | "category" | "goal" | "budget" | "holding";
  categories: Category[];
  quotes?: Quote[];
  accounts?: Account[];
}) {
  const [open, setOpen] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [accountId, setAccountId] = useState("none");
  const [installments, setInstallments] = useState("1");
  const [transactionType, setTransactionType] = useState("expense");
  const [transactionCategoryId, setTransactionCategoryId] = useState("none");
  const [holdingType, setHoldingType] = useState<keyof typeof investmentOptions>(
    "stock",
  );
  const [holdingSymbol, setHoldingSymbol] = useState("");
  const [cryptoPurchaseValue, setCryptoPurchaseValue] = useState("");
  const [fixedIncomeValue, setFixedIncomeValue] = useState("");
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const cryptoQuote = quotes.find((quote) => quote.symbol === holdingSymbol);
  const cryptoPurchaseReais = Number(cryptoPurchaseValue.replace(",", "."));
  const cryptoQuantity =
    holdingType === "crypto" && cryptoQuote?.value && cryptoPurchaseReais > 0
      ? cryptoPurchaseReais / cryptoQuote.value
      : 0;
  const cryptoSatoshis =
    holdingSymbol === "BTC" ? Math.round(cryptoQuantity * 100_000_000) : null;
  const transactionCategories = categories.filter(
    (category) => category.type === transactionType,
  );
  const selectedTransactionCategory = categories.find(
    (category) => String(category.id) === transactionCategoryId,
  );
  const transactionIsStreaming = isStreamingCategory(selectedTransactionCategory);
  const canSplit =
    transactionType === "expense" &&
    accounts.some((account) => String(account.id) === accountId && account.kind === "credit_card");
  const isInstallment = canSplit && Number(installments) > 1;
  const meta = {
    transaction: ["Novo lançamento", "Registre uma receita ou despesa."],
    category: ["Nova categoria", "Personalize a organização dos seus gastos."],
    goal: ["Nova meta", "Defina um objetivo financeiro."],
    budget: ["Novo orçamento", "Crie um limite mensal."],
    holding: ["Novo ativo", "Adicione um investimento à carteira."],
  }[type];
  function submit(form: FormData) {
    const actions = {
      transaction: addTransaction,
      category: addCategory,
      goal: addGoal,
      budget: addBudget,
      holding: addHolding,
    };
    startTransition(async () => {
      try {
        await actions[type](form);
        setOpen(false);
        toast.success("Dados salvos com sucesso.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível salvar.",
        );
      }
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={type === "transaction" ? "default" : "outline"}
            size="sm"
          />
        }
      >
        <Plus data-icon="inline-start" />
        {meta[0]}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{meta[0]}</DialogTitle>
          <DialogDescription>{meta[1]}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          {type === "transaction" && (
            <>
              {transactionIsStreaming ? (
                <Field label="Qual streaming?">
                  <Select name="description" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {streamingServices.map((service) => (
                          <SelectItem key={service} value={service}>
                            {streamingServiceImages[service] && (
                              <Image
                                src={streamingServiceImages[service]}
                                width={18}
                                height={18}
                                alt=""
                                className="size-[18px] rounded object-contain"
                              />
                            )}
                            {service}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field label="Descrição">
                  <Input name="description" placeholder="Ex.: Supermercado" required />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo">
                  <Select
                    name="type"
                    value={transactionType}
                    onValueChange={(value) => {
                      const nextType = String(value);
                      setTransactionType(nextType);
                      const selected = categories.find(
                        (category) => String(category.id) === transactionCategoryId,
                      );
                      if (!selected || selected.type !== nextType) setTransactionCategoryId("none");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Valor">
                  <Input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Categoria">
                  <Select
                    name="categoryId"
                    value={transactionCategoryId}
                    onValueChange={(value) => setTransactionCategoryId(String(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {transactionCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Primeira data">
                  <Input
                    name="date"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </Field>
              </div>
              {accounts.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Conta ou cartão">
                    <Select
                      name="accountId"
                      value={accountId}
                      onValueChange={(value) => setAccountId(String(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) => accounts.find((account) => String(account.id) === value)?.name ?? "Sem conta"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="none">Sem conta</SelectItem>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  {canSplit && !recurring && (
                    <Field label="Parcelas">
                      <Input
                        name="installments"
                        type="number"
                        min="1"
                        max="48"
                        value={installments}
                        onChange={(event) => setInstallments(event.target.value)}
                        required
                      />
                    </Field>
                  )}
                </div>
              )}
              {isInstallment && (
                <p className="text-xs text-muted-foreground">
                  Informe em Valor o total da compra. Ele será dividido em {installments} parcelas mensais a partir da primeira data.
                </p>
              )}
              {!isInstallment && (
                <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <input
                    name="recurring"
                    type="checkbox"
                    value="true"
                    checked={recurring}
                    onChange={(event) => setRecurring(event.target.checked)}
                  />
                  <span>
                    <span className="block font-medium">Repetir mensalmente</span>
                    <span className="text-xs text-muted-foreground">
                      Cria o lançamento no mesmo dia de cada mês.
                    </span>
                  </span>
                </label>
              )}
              {recurring && !isInstallment && (
                <Field label="Repetir até">
                  <Input
                    name="recurrenceEnd"
                    type="date"
                    min={today}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    A última cobrança será criada até esta data.
                  </p>
                </Field>
              )}
            </>
          )}
          {type === "category" && (
            <>
              <Field label="Nome">
                <Input name="name" placeholder="Ex.: Educação" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo">
                  <Select name="type" defaultValue="expense">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Ícone padrão">
                  <Select name="icon" defaultValue="wallet">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categoryIconOptions.map(([value, label]) => {
                          const Icon = categoryIcons[value];
                          return (
                            <SelectItem key={value} value={value}>
                              <Icon className="size-4" />
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Imagem personalizada (opcional)">
                <Input
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WebP ou AVIF, com até 2 MB. A imagem substitui o
                  ícone padrão.
                </p>
              </Field>
              <input type="hidden" name="color" value="blue" />
            </>
          )}
          {type === "goal" && (
            <>
              <Field label="Nome">
                <Input
                  name="name"
                  placeholder="Ex.: Reserva de emergência"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Objetivo">
                  <Input
                    name="target"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                  />
                </Field>
                <Field label="Valor atual">
                  <Input
                    name="current"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                    required
                  />
                </Field>
              </div>
              <Field label="Prazo">
                <Input name="deadline" type="date" />
              </Field>
            </>
          )}
          {type === "budget" && (
            <>
              <Field label="Nome">
                <Input name="name" placeholder="Ex.: Alimentação" required />
              </Field>
              <Field label="Categoria monitorada">
                <Select name="categoryId" required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter((category) => category.type === "expense").map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Limite mensal">
                <Input
                  name="limit"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                />
              </Field>
              <Field label="Mês">
                <Input
                  name="month"
                  type="month"
                  defaultValue={month}
                  required
                />
              </Field>
            </>
          )}
          {type === "holding" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo">
                  <Select
                    name="assetType"
                    value={holdingType}
                    onValueChange={(value) => {
                      setHoldingType(value as keyof typeof investmentOptions);
                      setHoldingSymbol("");
                      setCryptoPurchaseValue("");
                      setFixedIncomeValue("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="stock">Ação</SelectItem>
                        <SelectItem value="crypto">Cripto</SelectItem>
                        <SelectItem value="fund">Fundo</SelectItem>
                        <SelectItem value="cdb">CDB</SelectItem>
                        <SelectItem value="treasury">Tesouro Selic</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Ativo">
                  <Select
                    key={holdingType}
                    name="symbol"
                    value={holdingSymbol}
                    onValueChange={(value) => setHoldingSymbol(value ?? "")}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {investmentOptions[holdingType].map(([symbol, name]) => (
                          <SelectItem key={symbol} value={symbol}>
                            <span className="font-mono font-semibold">{symbol}</span>
                            <span className="text-muted-foreground">{name}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {holdingType === "crypto" ? (
                <>
                  <Field label="Valor da compra">
                    <Input
                      value={cryptoPurchaseValue}
                      onChange={(event) => setCryptoPurchaseValue(event.target.value)}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="R$ 0,00"
                      required
                    />
                  </Field>
                  <input type="hidden" name="quantity" value={cryptoQuantity || ""} />
                  <input type="hidden" name="averageCost" value={cryptoQuote?.value ?? ""} />
                  <div className="rounded-xl border bg-muted/30 p-4">
                    {holdingSymbol && !cryptoQuote ? (
                      <p className="text-sm text-amber-400">
                        Cotação de {holdingSymbol} indisponível. Selecione BTC para calcular automaticamente.
                      </p>
                    ) : cryptoQuantity > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Você receberá aproximadamente</p>
                          <p className="mt-1 font-mono text-lg font-semibold">
                            {cryptoQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} {holdingSymbol}
                          </p>
                        </div>
                        {cryptoSatoshis !== null && (
                          <div>
                            <p className="text-xs text-muted-foreground">Em satoshis</p>
                            <p className="mt-1 font-mono text-lg font-semibold text-cyan-400">
                              {cryptoSatoshis.toLocaleString("pt-BR")} sats
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          Cotação usada: {brl(Math.round((cryptoQuote?.value ?? 0) * 100))} por {holdingSymbol}.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Selecione o ativo e informe quanto você pagou para ver a conversão.
                      </p>
                    )}
                  </div>
                </>
              ) : isFixedIncomeType(holdingType) ? (
                <>
                  <Field label="Valor aplicado">
                    <Input
                      value={fixedIncomeValue}
                      onChange={(event) => setFixedIncomeValue(event.target.value)}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="R$ 0,00"
                      required
                    />
                  </Field>
                  <input type="hidden" name="quantity" value="1" />
                  <input type="hidden" name="averageCost" value={fixedIncomeValue} />
                  <Field label="Data da aplicação">
                    <Input
                      name="applicationDate"
                      type="date"
                      max={today}
                      defaultValue={today}
                      required
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Informe o total aplicado. A rentabilidade poderá ser acompanhada conforme os rendimentos forem atualizados.
                  </p>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Quantidade">
                    <Input name="quantity" type="number" min="0.00000001" step="any" required />
                  </Field>
                  <Field label="Preço médio">
                    <Input name="averageCost" type="number" min="0.01" step="0.01" required />
                  </Field>
                </div>
              )}
            </>
          )}
          <Button
            type="submit"
            disabled={
              pending ||
              (type === "holding" &&
                holdingType === "crypto" &&
                (!cryptoQuote || cryptoQuantity <= 0))
            }
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
