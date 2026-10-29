"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, LockKeyhole, Mail, Palette, ShieldCheck, Trash2, TriangleAlert, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { updateUserProfile } from "@/app/actions/finance";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Field } from "@/components/finance/shared";

export function SettingsView({
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
