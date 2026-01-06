import { useFetcher } from "react-router";
import { Mail, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import posthog from "posthog-js";

export function NewsletterForm({ variant = "card" }: { variant?: "card" | "minimal" }) {
  const fetcher = useFetcher();
  const [email, setEmail] = useState("");
  const isSuccess = fetcher.data?.success;
  const isError = fetcher.data?.error;
  const isLoading = fetcher.state === "submitting";

  useEffect(() => {
    if (isSuccess) {
        setEmail("");
        posthog.capture('newsletter_subscribed', { variant });
    }
  }, [isSuccess, variant]);

  if (variant === "minimal") {
    return (
        <div className="w-full max-w-md mx-auto">
            <fetcher.Form method="post" action="/api/newsletter" className="flex flex-col sm:flex-row gap-3">
                <input 
                    type="email" 
                    name="email" 
                    required
                    placeholder="Seu melhor e-mail" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-5 py-3 rounded-xl text-gray-900 border border-gray-200 focus:border-blue-500 focus:outline-none placeholder:text-gray-400 font-medium bg-white"
                />
                <button 
                    type="submit" 
                    disabled={isLoading || isSuccess}
                    className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        isSuccess 
                            ? "bg-green-500 text-white cursor-default" 
                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                    }`}
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                     isSuccess ? <><Check className="w-5 h-5" /> Escrito!</> : 
                     "Inscrever-se"}
                </button>
            </fetcher.Form>
            
            {isSuccess && (
                <p className="text-green-600 mt-4 text-sm font-medium animate-in fade-in slide-in-from-bottom-2 text-center">
                    ✅ Sucesso! Você receberá nossos alertas.
                </p>
            )}
            {isError && (
                <p className="text-red-600 mt-4 text-sm font-medium animate-in fade-in slide-in-from-bottom-2 text-center">
                    ❌ {fetcher.data.error}
                </p>
            )}
        </div>
    );
  }

  return (
    <div className="bg-blue-600 rounded-2xl p-8 md:p-12 text-center text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="w-64 h-64 bg-white rounded-full absolute -top-10 -left-10 blur-3xl"></div>
            <div className="w-64 h-64 bg-white rounded-full absolute -bottom-10 -right-10 blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-lg mx-auto">
            <div className="bg-blue-500/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-blue-400">
                <Mail className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">Não perca nenhuma votação importante</h2>
            <p className="text-blue-100 mb-8 leading-relaxed">
                Inscreva-se para receber alertas quando votações polêmicas (como aumento de impostos ou pautas de costumes) acontecerem na Câmara.
            </p>

            <fetcher.Form method="post" action="/api/newsletter" className="flex flex-col sm:flex-row gap-3">
                <input 
                    type="email" 
                    name="email" 
                    required
                    placeholder="Seu melhor e-mail" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-5 py-3 rounded-xl text-gray-900 border-2 border-transparent focus:border-blue-300 focus:outline-none placeholder:text-gray-400 font-medium"
                />
                <button 
                    type="submit" 
                    disabled={isLoading || isSuccess}
                    className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        isSuccess 
                            ? "bg-green-500 text-white cursor-default" 
                            : "bg-gray-900 hover:bg-gray-800 text-white shadow-lg shadow-gray-900/20"
                    }`}
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                     isSuccess ? <><Check className="w-5 h-5" /> Inscrito!</> : 
                     "Inscrever-se"}
                </button>
            </fetcher.Form>
            
            {isSuccess && (
                <p className="text-green-200 mt-4 text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
                    ✅ Sucesso! Você está na lista VIP.
                </p>
            )}
            {isError && (
                <p className="text-red-200 mt-4 text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
                    ❌ {fetcher.data.error}
                </p>
            )}
            
            <p className="text-blue-200 text-xs mt-6 opacity-70">
                Sem spam. Apenas política direto ao ponto. Cancele quando quiser.
            </p>
        </div>
    </div>
  );
}
