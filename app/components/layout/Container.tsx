import { cn } from "~/lib/utils";

/**
 * Régua horizontal única do site: 1168px de conteúdo, respiro de 56px no
 * desktop e 20px no mobile. Todas as telas usam este contêiner para que as
 * colunas fiquem alinhadas entre páginas.
 */
export function Container({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1168px] px-5 sm:px-8 lg:px-14", className)}
      {...props}
    >
      {children}
    </div>
  );
}
