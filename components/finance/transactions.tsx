"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Download, Pencil, ReceiptText, Search, Settings2, Trash2, Upload, WalletCards } from "lucide-react";
import { deleteTransaction, importTransactions, updateTransaction } from "@/app/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Category, Empty, Field, Tx, brl, categoryIcons, getStreamingServiceImage, isStreamingCategory, repairImportedText, streamingServiceImages, streamingServices, transactionIconStyles } from "@/components/finance/shared";

export function EditTransactionDialog({
  transaction,
  categories,
}: {
  transaction: Tx;
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [repeatFromHere, setRepeatFromHere] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState(transaction.type);
  const [categoryId, setCategoryId] = useState(() =>
    transaction.categoryId && categories.some(
      (category) => category.id === transaction.categoryId && category.type === transaction.type,
    ) ? String(transaction.categoryId) : "none",
  );
  const compatibleCategories = categories.filter(
    (category) => category.type === type,
  );
  const selectedCategory = categories.find(
    (category) => String(category.id) === categoryId,
  );
  const transactionIsStreaming = isStreamingCategory(selectedCategory);
  const currentStreamingService = streamingServices.includes(
    transaction.description as (typeof streamingServices)[number],
  )
    ? transaction.description
    : undefined;
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        await updateTransaction(transaction.id, form);
        setOpen(false);
        toast.success("Lançamento atualizado.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o lançamento.",
        );
      }
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${transaction.description}`}
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>
            Corrija os dados registrados nesta movimentação.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          {transactionIsStreaming ? (
            <Field label="Qual streaming?">
              <Select
                key={`${transaction.id}-${categoryId}`}
                name="description"
                defaultValue={currentStreamingService}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {!currentStreamingService && (
                      <SelectItem value={transaction.description}>
                        {transaction.description}
                      </SelectItem>
                    )}
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
              <Input name="description" defaultValue={transaction.description} required />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select
                name="type"
                value={type}
                onValueChange={(value) => {
                  const nextType = String(value);
                  setType(nextType);
                  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
                  if (!selectedCategory || selectedCategory.type !== nextType) setCategoryId("none");
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
                defaultValue={(transaction.amountCents / 100).toFixed(2)}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria">
              <Select
                name="categoryId"
                value={categoryId}
                onValueChange={(value) => setCategoryId(String(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {compatibleCategories.map((category) => {
                      const Icon =
                        categoryIcons[
                          category.icon as keyof typeof categoryIcons
                        ] ?? WalletCards;
                      return (
                        <SelectItem
                          key={category.id}
                          value={String(category.id)}
                        >
                          <Icon className="size-4" />
                          {category.name}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data">
              <Input
                name="date"
                type="date"
                defaultValue={transaction.date}
                required
              />
            </Field>
          </div>
          <Field label="Imagem desta transação (opcional)">
            <Input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WebP ou AVIF, com até 2 MB.
            </p>
          </Field>
          {transaction.imagePath && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeImage" value="true" />
              Remover imagem própria e voltar a usar a imagem da categoria
            </label>
          )}
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input
              name="recurring"
              type="checkbox"
              value="true"
              checked={repeatFromHere}
              onChange={(event) => setRepeatFromHere(event.target.checked)}
            />
            <span>
              <span className="block font-medium">
                Repetir mensalmente a partir daqui
              </span>
              <span className="text-xs text-muted-foreground">
                Cria novas ocorrências sem alterar as anteriores.
              </span>
            </span>
          </label>
          {repeatFromHere && (
            <Field label="Repetir até">
              <Input
                name="recurrenceEnd"
                type="date"
                min={transaction.date}
                required
              />
            </Field>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TransactionLabel({
  transaction,
  categories,
}: {
  transaction: Tx;
  categories: Category[];
}) {
  const category = categories.find(
    (item) => item.id === transaction.categoryId,
  );
  const streamingImage = isStreamingCategory(category)
    ? getStreamingServiceImage(transaction.description)
    : undefined;
  const customImage =
    transaction.imagePath ??
    streamingImage ??
    category?.imagePath ??
    transaction.categoryImage;
  const icon = category?.icon ?? transaction.categoryIcon;
  const iconKey = icon as keyof typeof categoryIcons;
  const isShell =
    !customImage &&
    /\b(gasolina|combust[ií]vel|posto shell|shell)\b/i.test(
      transaction.description,
    );
  const Icon = icon ? (categoryIcons[iconKey] ?? WalletCards) : ReceiptText;
  const iconStyle =
    customImage || isShell
      ? "border-white/10 bg-white"
      : (transactionIconStyles[iconKey as keyof typeof transactionIconStyles] ??
        transactionIconStyles.default);
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border shadow-sm ${iconStyle}`}
      >
        {customImage ? (
          <Image
            src={customImage}
            width={32}
            height={32}
            alt=""
            className="size-full object-cover"
          />
        ) : isShell ? (
          <Image
            src="/brands/shell.png"
            width={24}
            height={24}
            alt="Shell"
            className="size-6 object-contain"
          />
        ) : (
          <Icon className="size-4" strokeWidth={2.2} />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium">{transaction.description}</p>
        <p className="text-xs text-muted-foreground">
          {category?.name ?? transaction.categoryName ?? "Sem categoria"}
        </p>
      </div>
    </div>
  );
}

export function TransactionTable({
  transactions,
  categories = [],
  all = false,
}: {
  transactions: Tx[];
  categories?: Category[];
  all?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [importing, setImporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => {
    const source = all ? transactions : transactions.slice(0, 8);
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const min = minimum ? Number(minimum) * 100 : 0;
    const max = maximum ? Number(maximum) * 100 : Number.POSITIVE_INFINITY;
    return source.filter(
      (t) =>
        (kind === "all" || t.type === kind) &&
        (!term || t.description.toLocaleLowerCase("pt-BR").includes(term)) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        t.amountCents >= min &&
        t.amountCents <= max,
    );
  }, [all, from, kind, maximum, minimum, query, to, transactions]);
  async function remove(transaction: Tx) {
    if (
      !window.confirm(
        `Excluir “${transaction.description}”? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    try {
      await deleteTransaction(transaction.id);
      toast.success("Lançamento excluído.");
    } catch {
      toast.error("Não foi possível excluir o lançamento.");
    }
  }
  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const lines = [
      ["Descrição", "Data", "Tipo", "Valor", "Categoria"],
      ...rows.map((t) => [
        t.description,
        t.date,
        t.type === "income" ? "Receita" : "Despesa",
        (t.amountCents / 100).toFixed(2).replace(".", ","),
        t.categoryName ?? "",
      ]),
    ].map((line) => line.map((value) => escape(String(value))).join(";"));
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${lines.join("\n")}`], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `clareza-transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo CSV exportado.");
  }
  async function importFile(file: File) {
    setImporting(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("O CSV deve ter no máximo 2 MB");
      const csv = repairImportedText(await file.text()).replace(/^\uFEFF/, "");
      const firstLine = csv.split(/\r?\n/, 1)[0] ?? "";
      const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
      const records: string[][] = [];
      let record: string[] = [], field = "", quoted = false;
      for (let index = 0; index < csv.length; index++) {
        const char = csv[index];
        if (char === '"') {
          if (quoted && csv[index + 1] === '"') { field += '"'; index++; }
          else quoted = !quoted;
        } else if (char === delimiter && !quoted) { record.push(field); field = ""; }
        else if ((char === "\n" || char === "\r") && !quoted) {
          if (char === "\r" && csv[index + 1] === "\n") index++;
          record.push(field); if (record.some(value => value.trim())) records.push(record);
          record = []; field = "";
        } else field += char;
      }
      record.push(field); if (record.some(value => value.trim())) records.push(record);
      if (records.length < 2) throw new Error("O arquivo CSV está vazio");
      const headers = records[0];
      const raw = records.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
      const key = (value: string) =>
        repairImportedText(value)
          .replace(/^\uFEFF/, "")
          .replace(/^"|"$/g, "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
      const value = (row: Record<string, unknown>, names: string[]) => {
        const found = Object.keys(row).find((column) =>
          names.includes(key(column)),
        );
        return found ? row[found] : "";
      };
      const parsed = raw.map((row, index) => {
        const description = repairImportedText(
          String(value(row, ["descricao", "description"])),
        ).trim();
        const typeText = key(String(value(row, ["tipo", "type"])));
        const type =
          typeText === "receita" ||
          typeText === "income" ||
          typeText === "entrada"
            ? "income"
            : typeText === "despesa" ||
                typeText === "expense" ||
                typeText === "saida"
              ? "expense"
              : null;
        const rawDate = value(row, ["data", "date"]);
        const date = String(rawDate).trim().split("/").reverse().join("-");
        const rawAmount = String(value(row, ["valor", "amount"])).replace(
          /[^\d,.-]/g,
          "",
        );
        const amount = Number(
          rawAmount.includes(",")
            ? rawAmount.replaceAll(".", "").replace(",", ".")
            : rawAmount,
        );
        if (
          !description ||
          !type ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(amount) ||
          amount === 0
        )
          throw new Error(
            `Linha ${index + 2} inválida. Verifique Descrição, Data, Tipo e Valor.`,
          );
        return {
          description,
          type,
          date,
          amountCents: Math.round(Math.abs(amount) * 100),
          categoryName:
            repairImportedText(
              String(value(row, ["categoria", "category"])),
            ).trim() || undefined,
        };
      });
      const result = await importTransactions(parsed);
      const skipped = result.skipped
        ? ` ${result.skipped} ${result.skipped === 1 ? "linha já existia e foi ignorada" : "linhas já existiam e foram ignoradas"}.`
        : "";
      if (!result.count) toast.info(`Nenhuma transação nova.${skipped}`);
      else
        toast.success(
          `${result.count} transações importadas${result.newCategories ? ` e ${result.newCategories} categoria${result.newCategories === 1 ? "" : "s"} criada${result.newCategories === 1 ? "" : "s"}` : ""}.${skipped}`,
        );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível importar o arquivo.",
      );
    } finally {
      setImporting(false);
      if (importInput.current) importInput.current.value = "";
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {all ? "Todos os lançamentos" : "Transações recentes"}
        </CardTitle>
        <CardDescription>
          {all
            ? "Histórico completo das suas movimentações"
            : "Seus últimos lançamentos"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {all && (
          <>
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <input
                ref={importInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => importInput.current?.click()}
                disabled={importing}
              >
                <Upload data-icon="inline-start" />
                {importing ? "Importando…" : "Importar CSV"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!rows.length}
              >
                <Download data-icon="inline-start" />
                CSV
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-4 w-full justify-between sm:hidden"
              aria-expanded={filtersOpen}
              aria-controls="transaction-filters"
              onClick={() => setFiltersOpen((value) => !value)}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="size-4" />
                {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
              </span>
              {(query || kind !== "all" || from || to || minimum || maximum) && (
                <span className="size-2 rounded-full bg-primary" />
              )}
            </Button>
            <div
              id="transaction-filters"
              className={`${filtersOpen ? "grid" : "hidden"} mb-4 gap-3 sm:grid lg:grid-cols-6`}
            >
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar descrição"
                  className="pl-9"
                  aria-label="Buscar transações"
                />
              </div>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-3 text-sm"
                aria-label="Filtrar por tipo"
              >
                <option value="all">Todos os tipos</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
              </select>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="Data inicial"
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="Data final"
              />
              <Input
                type="number"
                min="0"
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
                placeholder="Valor mínimo"
              />
              <Input
                type="number"
                min="0"
                value={maximum}
                onChange={(e) => setMaximum(e.target.value)}
                placeholder="Valor máximo"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setKind("all");
                  setFrom("");
                  setTo("");
                  setMinimum("");
                  setMaximum("");
                  setFiltersOpen(false);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </>
        )}
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <TransactionLabel transaction={t} categories={categories} />
                  </TableCell>
                  <TableCell>
                    {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={t.type === "income" ? "default" : "secondary"}
                    >
                      {t.type === "income" ? "Receita" : "Despesa"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-semibold ${t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {t.type === "expense" ? "−" : "+"}
                    {brl(t.amountCents)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <EditTransactionDialog
                        transaction={t}
                        categories={categories}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Excluir ${t.description}`}
                        onClick={() => remove(t)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty
            text={
              query || kind !== "all" || from || to || minimum || maximum
                ? "Nenhum lançamento encontrado com esses filtros."
                : "Adicione seu primeiro lançamento para começar."
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
