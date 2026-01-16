import { createBrowserClient } from "@supabase/ssr";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect, useState } from "react";
import { useMediaQuery } from "~/hooks/use-media-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "~/components/ui/dialog";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
} from "~/components/ui/drawer";
import { Button } from "~/components/ui/button";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const [supabase] = useState(() =>
        createBrowserClient(
            import.meta.env.VITE_SUPABASE_URL!,
            import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
        )
    );

    // Use explicit media query to match Tailwind's 'md' breakpoint (768px)
    const isDesktop = useMediaQuery("(min-width: 768px)");

    useEffect(() => {
        if (!isOpen) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_IN") {
                onClose();
                window.location.reload();
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase, onClose, isOpen]);

    const AuthForm = () => (
        <div className="w-full">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🗳️</span>
            </div>

            <Auth
                supabaseClient={supabase}
                appearance={{
                    theme: ThemeSupa,
                    variables: {
                        default: {
                            colors: {
                                brand: '#2F3061', // Twilight Indigo
                                brandAccent: '#0E34A0', // Egyptian Blue
                                inputText: '#343434', // Graphite
                                inputLabelText: '#666666',
                                inputBorder: '#DFDFDF', // Alabaster Grey
                                inputBorderFocus: '#2F3061',
                                inputBorderHover: '#2F3061',
                            },
                            radii: {
                                borderRadiusButton: '8px', // Matching shadcn radius
                                inputBorderRadius: '8px',
                            }
                        }
                    },
                    className: {
                        container: 'w-full gap-4 flex flex-col',
                        button: 'w-full flex items-center justify-center gap-2 font-medium h-11 px-8 rounded-md bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors', // Matching shadcn button styles
                        input: 'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', // Matching shadcn input styles
                        label: 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-1.5 block text-left', // Matching shadcn label
                    }
                }}
                providers={["google", "apple"]}
                redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`}
                onlyThirdPartyProviders={false}
            />

            <p className="text-xs text-center text-gray-400 mt-6 px-4">
                Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
            </p>
        </div>
    );

    if (isDesktop) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center">Bem-vindo ao Em Quem Votar</DialogTitle>
                        <DialogDescription className="text-center">
                            Crie sua conta para salvar seus políticos favoritos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="pt-4 pb-2">
                        <AuthForm />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent>
                <DrawerHeader className="text-left">
                    <DrawerTitle>Bem-vindo ao Em Quem Votar</DrawerTitle>
                    <DrawerDescription>
                        Crie sua conta para salvar seus políticos favoritos.
                    </DrawerDescription>
                </DrawerHeader>
                <div className="p-4 pb-12">
                    <AuthForm />
                    <div className="mt-4">
                        <Button variant="outline" className="w-full" onClick={onClose}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
