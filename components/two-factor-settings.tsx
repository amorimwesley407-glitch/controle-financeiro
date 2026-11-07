"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, KeyRound, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { renderSVG } from "uqr";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Field } from "@/components/finance/shared";

type Step = "password" | "scan" | "codes";
type Mode = "enable" | "disable" | "codes";

const errorText = (error: { status?: number; code?: string; message?: string }) =>
  error.status === 429
    ? "Muitas tentativas. Aguarde alguns segundos."
    : error.code === "INVALID_PASSWORD"
      ? "Senha incorreta."
      : error.code === "INVALID_CODE"
        ? "Código incorreto. Confira o app e tente de novo."
        : "Não foi possível concluir. Tente novamente.";

/** Códigos de recuperação: mostrados uma vez só, com opção de copiar ou baixar. */
function BackupCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");
  function download() {
    const url = URL.createObjectURL(new Blob([`Códigos de recuperação do Clareza\nCada um funciona uma vez só.\n\n${text}\n`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "clareza-codigos-de-recuperacao.txt";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Códigos copiados."))}>
          <Copy data-icon="inline-start" />
          Copiar
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          <Download data-icon="inline-start" />
          Baixar
        </Button>
      </div>
    </div>
  );
}

/**
 * Verificação em duas etapas com app autenticador (Google Authenticator, Authy, 1Password…).
 * Ativar pede a senha, mostra o QR code, confere um código do app e entrega os códigos de recuperação.
 */
export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const secret = totpURI ? new URL(totpURI).searchParams.get("secret") ?? "" : "";

  function start(next: Mode) {
    setMode(next);
    setStep("password");
    setPassword("");
    setCode("");
    setTotpURI("");
    setBackupCodes([]);
    setError("");
  }
  function close() {
    // Os dados do app só mudam quando a ativação termina; fechar no meio deixa tudo como estava.
    if (mode === "enable" && step === "codes") router.refresh();
    setMode(null);
  }
  async function run(action: () => Promise<{ error: { status?: number; code?: string } | null }>, onSuccess: () => void) {
    setLoading(true);
    setError("");
    try {
      const result = await action();
      if (result.error) return setError(errorText(result.error));
      onSuccess();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }
  function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "enable")
      void run(
        async () => {
          const result = await authClient.twoFactor.enable({ password });
          if (result.data?.method === "totp") {
            setTotpURI(result.data.totpURI);
            setBackupCodes(result.data.backupCodes);
          }
          return result;
        },
        () => setStep("scan"),
      );
    else if (mode === "disable")
      void run(
        () => authClient.twoFactor.disable({ password }),
        () => {
          setMode(null);
          toast.success("Verificação em duas etapas desativada.");
          router.refresh();
        },
      );
    else
      void run(
        async () => {
          const result = await authClient.twoFactor.generateBackupCodes({ password });
          if (result.data) setBackupCodes(result.data.backupCodes);
          return result;
        },
        () => setStep("codes"),
      );
  }
  function submitCode(event: React.FormEvent) {
    event.preventDefault();
    void run(
      () => authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") }),
      () => {
        setStep("codes");
        toast.success("Verificação em duas etapas ativada.");
      },
    );
  }
  const titles: Record<Mode, string> = {
    enable: "Ativar verificação em duas etapas",
    disable: "Desativar verificação em duas etapas",
    codes: "Novos códigos de recuperação",
  };
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
            <Smartphone className="size-5" />
          </span>
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              Verificação em duas etapas
              {enabled && <Badge variant="secondary">Ativa</Badge>}
            </CardTitle>
            <CardDescription>
              {enabled
                ? "Ao entrar, além da senha, o app pede o código do seu app autenticador."
                : "Além da senha, peça um código do app autenticador do celular (Google Authenticator, Authy, 1Password…) ao entrar."}
            </CardDescription>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {enabled ? (
            <>
              <Button variant="outline" onClick={() => start("codes")}>
                <KeyRound className="size-4" />
                Novos códigos
              </Button>
              <Button variant="outline" onClick={() => start("disable")}>Desativar</Button>
            </>
          ) : (
            <Button onClick={() => start("enable")}>
              <ShieldCheck className="size-4" />
              Ativar
            </Button>
          )}
        </div>
      </CardHeader>
      <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode ? titles[mode] : ""}</DialogTitle>
            <DialogDescription>
              {step === "password" && "Confirme sua senha para continuar."}
              {step === "scan" && "1. Abra o app autenticador e escaneie o QR code (ou digite a chave). 2. Digite o código de 6 dígitos que aparecer."}
              {step === "codes" && "Guarde estes códigos em um lugar seguro. Se perder o celular, cada um permite entrar uma vez. Eles não serão mostrados de novo."}
            </DialogDescription>
          </DialogHeader>
          {step === "password" && (
            <form onSubmit={submitPassword} className="flex flex-col gap-4">
              <Field label="Senha atual">
                <Input type="password" aria-label="Senha atual" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus />
              </Field>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant={mode === "disable" ? "destructive" : "default"} disabled={loading}>
                {loading && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
                {mode === "disable" ? "Desativar" : "Continuar"}
              </Button>
            </form>
          )}
          {step === "scan" && (
            <form onSubmit={submitCode} className="flex flex-col gap-4">
              {/* O QR fica sobre fundo branco para os apps conseguirem ler também no tema escuro. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(totpURI, { border: 2 }))}`}
                alt="QR code para configurar o app autenticador"
                className="mx-auto size-48 rounded-lg bg-white p-2"
              />
              <p className="text-center text-xs text-muted-foreground">
                Não consegue escanear? Digite a chave: <span className="break-all font-mono text-foreground">{secret}</span>
              </p>
              <Field label="Código do app">
                <Input
                  aria-label="Código do app"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={7}
                  className="font-mono text-lg tracking-widest"
                  required
                  autoFocus
                />
              </Field>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading}>
                {loading && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
                Confirmar e ativar
              </Button>
            </form>
          )}
          {step === "codes" && (
            <div className="flex flex-col gap-4">
              <BackupCodes codes={backupCodes} />
              <Button onClick={close}>Concluir</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
