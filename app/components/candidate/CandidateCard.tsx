import { Link } from "react-router";
import type { RegistrationStatus } from "~/lib/candidate-status";
import { CandidateAvatar } from "./CandidateAvatar";
import { CompareToggle } from "./CompareToggle";
import { StatusBadge } from "./StatusBadge";

export interface CandidateCardData {
  id: string;
  name: string;
  displayName: string;
  party: string;
  coalition: string | null;
  photoUrl: string | null;
  registrationStatus: RegistrationStatus;
  tseStatusLabel: string | null;
  number: number | null;
  viceName: string | null;
  viceParty: string | null;
  positionCount: number;
}

/**
 * Card da listagem. Peso visual idêntico para toda candidatura: mesmo
 * tamanho, mesma tipografia, sem cor partidária e sem destaque para quem
 * tem mais dados. A única diferença admitida é a situação de registro,
 * porque ela é um fato do TSE.
 */
export function CandidateCard({
  candidate,
  selected,
  onToggleCompare,
}: {
  candidate: CandidateCardData;
  selected: boolean;
  onToggleCompare: () => void;
}) {
  const subtitle = [
    candidate.party,
    candidate.number != null ? `nº ${candidate.number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    /*
      O anel de foco desenha o cartão inteiro, não só o nome: quem chega aqui
      pelo Tab está percorrendo uma grade de cartões, e o alvo mental é o
      cartão. O elemento que de fato recebe foco é o <Link>, que se estica
      sobre o cartão pelo `after:inset-0` — daí `has-[a:focus-visible]`.
      Restrito ao `a` de propósito: o CompareToggle tem anel próprio, e dois
      anéis concêntricos ao focar o botão diriam duas coisas ao mesmo tempo.

      Antes daqui saía a borda de foco em indigo-300, que era exatamente a
      mesma borda do `hover:` — foco de teclado e passagem de mouse ficavam
      indistinguíveis — e rendia 1,99:1 contra o branco do cartão, abaixo dos
      3:1 do SC 1.4.11. O `outline` de indigo-600 dá 6,3:1, e o deslocamento
      o apoia no fundo da página em vez da borda do cartão.

      `min-w-0` no PRÓPRIO cartão, não só no bloco de texto interno.

      O cartão é um item de grade, e todo item de grade nasce com
      `min-width: auto` — ou seja, ele se recusa a ficar menor que o
      min-content dos filhos. Com `truncate` (que é `white-space: nowrap`) o
      min-content de um texto é a linha INTEIRA, então um nome comprido
      empurrava a coluna para além da pista: medido em 390px, 98 dos 211
      cartões estouravam e o documento ficava 404px de largura numa viewport
      de 390. É o SC 1.4.10 (Reflow) quebrado — a página rolava de lado.

      O `min-w-0` do <div> interno não resolvia porque o item de grade é o
      <article>, uma caixa acima. Trocar `truncate` por `line-clamp-2`
      (abaixo) já derruba o `nowrap` e com ele a maior parte do min-content,
      mas o `min-w-0` fica: é a correção na raiz, e vale para qualquer
      conteúdo futuro do cartão.
    */
    <article className="group relative flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-[18px] transition-colors hover:border-indigo-300 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-indigo-600">
      <div className="flex items-center gap-3">
        <CandidateAvatar
          name={candidate.displayName}
          photoUrl={candidate.photoUrl}
          size="md"
        />
        <div className="min-w-0">
          {/*
            O nome de uma pessoa NÃO é truncado. Numa tela cujo único trabalho
            é ajudar o eleitor a encontrar alguém, "RUI COSTA PIME…" e
            "ESCRITOR AUGU…" são o pior lugar possível para economizar
            espaço — e era o que acontecia nas colunas de 253px do desktop.
            Duas linhas com `line-clamp-2` cabem os 29 caracteres do nome mais
            longo da base; o clamp existe para que a altura do cartão continue
            previsível, não para esconder o nome.

            `break-words` e não `hyphens-auto`: hifenização automática quebra
            SOBRENOME em "SOBRE-NOME" para encher melhor a linha, e inventar
            hífen no nome de uma pessoa é errar o nome dela. `break-words` só
            age quando a palavra sozinha não caberia na linha.
          */}
          <h3 className="line-clamp-2 text-base font-bold break-words text-slate-800">
            <Link
              to={`/candidato/${candidate.id}`}
              prefetch="intent"
              // O anel deste link é o do cartão (acima). Sem isto o navegador
              // desenharia um segundo, apertado no nome, dizendo a mesma coisa
              // duas vezes. `:has()` é anterior ao piso de navegador que o
              // Tailwind v4 já exige, então o anel do cartão não falha antes
              // do resto da folha de estilo.
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {candidate.displayName}
            </Link>
          </h3>
          {/*
            Sem `truncate` pelo mesmo motivo do nome: o subtítulo é o partido
            e o NÚMERO DE URNA — o dado com que a pessoa efetivamente vota.
            Cortá-lo seria cortar a informação mais acionável do cartão, e um
            `title` não resolve (não há hover no celular). O mais longo da
            base tem 21 caracteres ("SOLIDARIEDADE · nº 77") e cabe numa linha
            até na coluna mais estreita da grade; se um dia não couber, quebrar
            é melhor que esconder.
          */}
          <p className="mt-px text-xs break-words text-slate-500">{subtitle}</p>
        </div>
      </div>

      <StatusBadge
        status={candidate.registrationStatus}
        tseStatusLabel={candidate.tseStatusLabel}
      />

      {/*
        Mesmo motivo do nome acima: "Vice: LEONARDO AVALANCHE (PRT…" cortava o
        nome do vice E o partido dele. O mais longo da base tem 38 caracteres
        ("EDIVALDO HOLANDA JUNIOR (REPUBLICANOS)") e cabe em duas linhas.
      */}
      {candidate.viceName && (
        <p className="line-clamp-2 text-xs break-words text-slate-500">
          Vice: {candidate.viceName}
          {candidate.viceParty ? ` (${candidate.viceParty})` : ""}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5">
        {/*
          `aria-hidden`: isto NÃO é um link. O link do cartão é o <Link> do
          nome, esticado sobre a caixa inteira pelo `after:inset-0` — este
          texto só desenha a afordância para quem enxerga. Sem o atributo, o
          leitor de tela lia "Ver perfil" como texto solto ao lado de um link
          sem relação visível com ele; transformá-lo num segundo <a> seria
          pior, porque anunciaria dois links para o mesmo destino no mesmo
          cartão.
        */}
        <span
          aria-hidden="true"
          className="text-xs font-semibold text-indigo-600"
        >
          Ver perfil →
        </span>
        <span className="relative z-10">
          <CompareToggle
            selected={selected}
            onToggle={onToggleCompare}
            candidateName={candidate.displayName}
          />
        </span>
      </div>
    </article>
  );
}
