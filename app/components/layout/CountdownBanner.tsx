import { countdownCopy } from "~/lib/election";

/**
 * Texto do contador, numa fonte só.
 *
 * O `lead` é a parte que o banner destaca em negrito e que a linha do rodapé
 * usa corrida. Existe para que as duas superfícies não escrevam a mesma frase
 * duas vezes: uma contagem regressiva que diverge entre dois cantos da página
 * é pior do que não existir.
 */
function countdownParts({
  days,
  label,
  dateLabel,
}: ReturnType<typeof countdownCopy>) {
  if (days === 0) {
    return { lead: "É hoje", rest: `— ${dateLabel}, dia do ${label}` };
  }
  return {
    lead: days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`,
    rest: `para o ${label} — ${dateLabel}`,
  };
}

/** A mesma frase do banner, em texto corrido. Usada pelo `SiteFooter`. */
export function countdownSentence(copy: ReturnType<typeof countdownCopy>) {
  const { lead, rest } = countdownParts(copy);
  return `${lead} ${rest}`;
}

/**
 * Faixa de contagem regressiva. Recebe `days` calculado no servidor para
 * evitar divergência de hidratação entre o fuso do servidor e o do
 * navegador — a data de referência é sempre Brasília.
 *
 * POR QUE ELA CONTINUA SÓ NA HOME. A faixa é o dispositivo de urgência do
 * produto, e quem entra por `/candidatos` ou `/quiz` (a maioria, vinda de
 * busca) não a via. A correção não foi subir a faixa para o chrome global:
 * uma faixa em toda rota custaria ~42px dos 844 de uma tela de 390px, em cima
 * dos 75px do cabeçalho fixo, empurrando o `<h1>` de TODA página para baixo
 * pelo mesmo aviso — e um aviso repetido em toda tela deixa de ser lido.
 * A régua horizontal também não tem folga: com seis itens de menu o cabeçalho
 * só cabe a partir de 1024px, então um contador embutido na barra ficaria
 * invisível justamente no telefone, onde o problema foi levantado.
 *
 * O que subiu para o chrome global foi a INFORMAÇÃO, não a faixa: o
 * `SiteFooter` traz a mesma frase (`countdownSentence`) em uma linha discreta,
 * presente em toda rota e em toda largura, a custo vertical zero. A faixa
 * cheia fica onde tem espaço para ser alta — a home, acima do herói.
 */
export function CountdownBanner(copy: ReturnType<typeof countdownCopy>) {
  const { lead, rest } = countdownParts(copy);

  return (
    <div className="border-b border-indigo-600/[0.12] bg-indigo-600/[0.05] px-5 py-2.5 text-center text-sm text-indigo-600">
      <strong className="font-semibold">{lead}</strong> {rest}
    </div>
  );
}
