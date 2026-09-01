/**
 * Vocabulário visual das telas de /admin.
 *
 * Estas classes estavam copiadas entre `admin.login`, `admin._index`,
 * `admin.candidato.$id` e `admin.votacao.$id` — e a cópia do INPUT levava
 * junto o mesmo defeito em todas: o contorno nativo do navegador era
 * desligado e no lugar dele entrava um anel de foco a 10% de opacidade,
 * sobre borda indigo clara. Em cartão branco isso é foco praticamente
 * invisível, em três telas ao mesmo tempo, e três lugares para lembrar de
 * consertar. Aqui é um só.
 *
 * O anel agora vem da utilitária `.focus-ring` (app/app.css): contorno de 2px
 * em indigo-600 com deslocamento, sob `:focus-visible`. São 6,3:1 contra o
 * branco do cartão, no lugar dos 1,99:1 da borda clara que acompanhava o anel
 * invisível.
 *
 * As três utilitárias antigas estão descritas, não nomeadas, de propósito: o
 * scanner do Tailwind v4 colhe candidatas de dentro dos comentários também.
 * Citá-las pelo nome fazia o build reemitir exatamente as regras que este
 * texto explica terem sido removidas — e um grep no CSS compilado seguiria
 * acusando o defeito muito depois de ele estar corrigido.
 *
 * São strings de classe, não componentes, de propósito: o painel monta os
 * formulários com HTML semântico direto (ver "Conventions" no CLAUDE.md), e
 * uma camada de wrappers só para carregar `className` não paga o próprio
 * custo.
 */

export const CARD = "rounded-2xl border border-slate-200 bg-white";

export const LABEL =
  "mb-1.5 block text-xs font-semibold tracking-[0.06em] text-slate-500 uppercase";

export const INPUT =
  "focus-ring w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-500";

export const BTN_PRIMARY =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-50";

export const BTN_QUIET =
  "focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 disabled:opacity-50";
