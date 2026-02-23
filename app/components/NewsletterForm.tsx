import { useFetcher } from "react-router";
import { Mail, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

export function NewsletterForm({
  variant = "card",
}: {
  variant?: "card" | "minimal";
}) {
  const fetcher = useFetcher();
  const [email, setEmail] = useState("");
  const isSuccess = fetcher.data?.success;
  const isError = fetcher.data?.error;
  const isLoading = fetcher.state === "submitting";

  useEffect(() => {
    if (isSuccess) {
      setEmail("");
    }
  }, [isSuccess]);

  if (variant === "minimal") {
    return (
      <div className="w-full max-w-md mx-auto">
        <fetcher.Form
          method="post"
          action="/api/newsletter"
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="Seu melhor e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-foreground border border-border bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5",
              isSuccess
                ? "bg-muted text-foreground cursor-default"
                : "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSuccess ? (
              <>
                <Check className="w-4 h-4" /> Inscrito!
              </>
            ) : (
              "Inscrever-se"
            )}
          </button>
        </fetcher.Form>

        {isSuccess && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Sucesso! Você receberá nossos alertas.
          </p>
        )}
        {isError && (
          <p className="text-xs text-destructive mt-3 text-center">
            {fetcher.data.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 sm:p-8 text-center">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-muted rounded-xl">
          <Mail className="w-5 h-5 text-muted-foreground" />
        </div>

        <h2 className="text-lg font-semibold text-foreground">
          Não perca nenhuma votação importante
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Inscreva-se para receber alertas quando votações relevantes
          acontecerem no Congresso e atualizações sobre os candidatos.
        </p>

        <fetcher.Form
          method="post"
          action="/api/newsletter"
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="Seu melhor e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-foreground border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5",
              isSuccess
                ? "bg-muted text-foreground cursor-default"
                : "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSuccess ? (
              <>
                <Check className="w-4 h-4" /> Inscrito!
              </>
            ) : (
              "Inscrever-se"
            )}
          </button>
        </fetcher.Form>

        {isSuccess && (
          <p className="text-xs text-muted-foreground">
            Sucesso! Você está na lista.
          </p>
        )}
        {isError && (
          <p className="text-xs text-destructive">{fetcher.data.error}</p>
        )}

        <p className="text-[10px] text-muted-foreground/60">
          Sem spam. Apenas política direto ao ponto. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
