"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Pencil, Trash2, WalletCards } from "lucide-react";
import { deleteCategory, updateCategory } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Category, Empty, Field, categoryIconOptions, categoryIcons } from "@/components/finance/shared";
import { FormDialog } from "@/components/finance/form-dialog";

export function EditCategoryDialog({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        await updateCategory(category.id, form);
        setOpen(false);
        toast.success("Categoria atualizada.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a categoria.",
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
            aria-label={`Editar ${category.name}`}
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar categoria</DialogTitle>
          <DialogDescription>
            Altere os dados e o ícone desta categoria.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" defaultValue={category.name} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select name="type" defaultValue={category.type}>
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
              <Select name="icon" defaultValue={category.icon}>
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
          <Field label="Nova imagem personalizada">
            <Input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
            />
          </Field>
          {category.imagePath && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeImage" value="true" />
              Remover imagem atual e usar o ícone padrão
            </label>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesView({ categories }: { categories: Category[] }) {
  async function remove(category: Category) {
    if (
      !window.confirm(
        `Excluir a categoria “${category.name}”? As transações serão mantidas sem categoria.`,
      )
    )
      return;
    try {
      await deleteCategory(category.id);
      toast.success("Categoria excluída.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a categoria.",
      );
    }
  }
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Suas categorias</CardTitle>
          <CardDescription>
            Use categorias para entender para onde vai seu dinheiro
          </CardDescription>
        </div>
        <FormDialog type="category" categories={categories} />
      </CardHeader>
      <CardContent>
        {categories.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => {
              const Icon =
                categoryIcons[c.icon as keyof typeof categoryIcons] ??
                WalletCards;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                      {c.imagePath ? (
                        <Image
                          src={c.imagePath}
                          width={40}
                          height={40}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <Icon className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.type === "income" ? "Receita" : "Despesa"}
                      </p>
                    </div>
                  </div>
                  <div className="ml-2 flex shrink-0">
                    <EditCategoryDialog category={c} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ${c.name}`}
                      onClick={() => void remove(c)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="Crie categorias para organizar seus lançamentos." />
        )}
      </CardContent>
    </Card>
  );
}
