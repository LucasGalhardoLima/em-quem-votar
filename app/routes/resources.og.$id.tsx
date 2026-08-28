import { CandidateService } from "~/services/candidate.server";
import type { Route } from "./+types/resources.og.$id";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

/**
 * As duas fontes vinham de
 * `github.com/google/fonts/raw/main/apache/robotoslab/RobotoSlab-{Bold,Regular}.ttf`
 * — e as duas respondem **404** (verificado em 27/08/2026): o repositório do
 * Google Fonts hoje publica só a fonte variável `RobotoSlab[wght].ttf` naquele
 * diretório. O loader caía direto no 503 e nunca gerou uma imagem. Ninguém
 * percebeu porque nenhuma página apontava para esta rota; agora que as tags
 * Open Graph apontam, ela precisa funcionar de verdade.
 *
 * A correção resolve as URLs pela API CSS2 do Google Fonts em vez de fixá-las:
 * caminho fixo em CDN de fonte é exatamente o que quebrou aqui, porque o
 * segmento de versão (`/v36/`) muda sozinho. Um User-Agent antigo faz a API
 * devolver `format('truetype')` — o satori lê TTF, não WOFF2.
 */
const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700";

/**
 * Memoizamos a promessa (não o resultado) para que requisições concorrentes
 * durante o cold start compartilhem o mesmo download em vez de dispararem
 * um cada. O cache vive enquanto a instância viver.
 */
let fontsPromise: Promise<{ bold: ArrayBuffer; regular: ArrayBuffer }> | null =
  null;

async function fetchTtf(url: string, label: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fonte ${label}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const cssRes = await fetch(FONT_CSS_URL, {
        // O UA antigo é o que faz a API servir TTF em vez de WOFF2.
        headers: { "User-Agent": "Mozilla/4.0" },
      });
      if (!cssRes.ok) throw new Error(`css das fontes: HTTP ${cssRes.status}`);
      const css = await cssRes.text();

      // A API devolve os @font-face na ordem dos pesos pedidos: 400, depois 700.
      const urls = [...css.matchAll(/url\((https:\/\/[^)]+\.ttf)\)/g)].map(
        (m) => m[1]
      );
      if (urls.length < 2) {
        throw new Error(`css das fontes sem TTF (${urls.length} url(s))`);
      }

      const [regular, bold] = await Promise.all([
        fetchTtf(urls[0], "regular"),
        fetchTtf(urls[1], "bold"),
      ]);
      return { bold, regular };
    })().catch((err) => {
      // Não guarda a falha: a próxima requisição tenta de novo.
      fontsPromise = null;
      throw err;
    });
  }
  return fontsPromise;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!params.id) {
    return new Response("Not Found", { status: 404 });
  }

  // `getOgCard` traz só os cinco campos que o PNG usa. Importa mais agora do
  // que antes: com as tags Open Graph apontando para cá, esta rota passou a ser
  // chamada por todo crawler de rede social, e `getById` carregava a ficha
  // inteira (bens, histórico, 20 votações) para jogar quase tudo fora.
  const candidate = await CandidateService.getOgCard(params.id);

  if (!candidate) {
    return new Response("Not Found", { status: 404 });
  }

  /*
    O satori rejeita caminho relativo em <img> ("Image source must be an
    absolute URL"), e a foto oficial das 211 candidaturas é servida de
    `public/candidatos/<tseId>.jpg` — ou seja, sempre relativa. Resolvemos
    contra a origem do próprio request: `new URL(rel, origin)` devolve a
    absoluta e deixa passar intacta uma URL que já seja absoluta.
  */
  const origin = new URL(request.url).origin;
  const photoUrl = candidate.photoUrl
    ? new URL(candidate.photoUrl, origin).toString()
    : null;

  let fontData: ArrayBuffer;
  let regularFontData: ArrayBuffer;
  try {
    const fonts = await loadFonts();
    fontData = fonts.bold;
    regularFontData = fonts.regular;
  } catch (error) {
    // Sem fonte não há como renderizar. Melhor devolver 503 com retry curto
    // do que uma imagem quebrada cacheada por um ano.
    console.error("[og] falha ao carregar fontes:", error);
    return new Response("Service Unavailable", {
      status: 503,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  /*
    O CARD DE COMPARTILHAMENTO

    Esta é a superfície onde o contexto se perde. No Brasil o WhatsApp é ao
    mesmo tempo o principal canal de compartilhamento político e o principal
    vetor de desinformação, e um card sem procedência vira, fora do site,
    "a plataforma disse X sobre fulano". Por isso ele carrega a própria fonte.

    O QUE FOI REMOVIDO, E POR QUÊ: a versão anterior renderizava as `tags` da
    candidatura como chips preenchidos, sob o título "Posicionamentos". As tags
    são rótulos ideológicos de uma palavra — "Progressista", "Estatista",
    "Armamentista", "Ausente" — sem documento, página ou citação por trás.
    Carimbar isso na foto de uma pessoa real, no artefato mais fácil de
    printar, contradiz a metodologia §2, que exige rastro para toda posição.
    Nenhuma das 211 candidaturas tem tag hoje, então o chip nunca chegou a
    aparecer; o desenho é que estava pronto para publicá-lo.

    PALETA: `slate` + `indigo-600`, como manda o CLAUDE.md. A versão anterior
    usava seis cores fora do sistema (#0E34A0, #2F3061, #DFDFDF, #343434,
    #5a5a5a, #e8eaf6).

    NEUTRALIDADE: tudo aqui é idêntico entre candidaturas. A linha de
    procedência é a mesma para as 211 — deliberadamente não exibimos a
    contagem de temas documentados, que varia e, ao lado de um rosto, leria
    como nota, não como fonte. Esse número existe na ficha, onde há espaço
    para explicá-lo.
  */
  const svg = await satori(
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        flexDirection: "column",
        backgroundColor: "#f1f5f9",
        fontFamily: '"Roboto Slab"',
        padding: "44px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "28px",
          border: "1px solid #e2e8f0",
          padding: "56px 60px",
          justifyContent: "space-between",
        }}
      >
        {/*
          Sem `alt` de propósito: o satori rasteriza esta árvore para PNG, não
          para DOM — nenhum leitor de tela chega até aqui. O texto alternativo
          da imagem é a tag `og:image:alt`, definida em candidato.$id.tsx.
        */}
        <div style={{ display: "flex", alignItems: "center", gap: "52px" }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              width={320}
              height={320}
              style={{
                borderRadius: "50%",
                objectFit: "cover",
                border: "6px solid #e2e8f0",
              }}
            />
          ) : (
            <div
              style={{
                width: 320,
                height: 320,
                borderRadius: "50%",
                backgroundColor: "#f1f5f9",
                border: "6px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "120px",
                color: "#94a3b8",
              }}
            >
              {candidate.displayName.slice(0, 1)}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                fontSize: "24px",
                color: "#64748b",
                fontWeight: 700,
                letterSpacing: "4px",
                marginBottom: "18px",
                textTransform: "uppercase",
              }}
            >
              Em quem votar?
            </div>
            <div
              style={{
                fontSize: "62px",
                color: "#0f172a",
                fontWeight: 700,
                lineHeight: 1.05,
              }}
            >
              {candidate.displayName}
            </div>
            <div
              style={{
                fontSize: "34px",
                color: "#4f46e5",
                fontWeight: 400,
                marginTop: "14px",
              }}
            >
              {candidate.coalition
                ? `${candidate.party} · ${candidate.coalition}`
                : candidate.party}
            </div>
          </div>
        </div>

        {/*
          A ASSINATURA: a barra de citação. É o gesto que o site faz em toda
          posição — trecho literal com a fonte ao lado — aplicado ao próprio
          card. A linha é idêntica para as 211 candidaturas.
        */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              width: "6px",
              height: "44px",
              backgroundColor: "#4f46e5",
              borderRadius: "3px",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: "23px",
              color: "#64748b",
              fontWeight: 400,
              lineHeight: 1.35,
            }}
          >
            Posições extraídas da proposta de governo protocolada no TSE, com
            documento, página e trecho citados.
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Roboto Slab",
          data: fontData,
          weight: 700,
          style: "normal",
        },
        {
          name: "Roboto Slab",
          data: regularFontData,
          weight: 400,
          style: "normal",
        },
      ],
    }
  );

  const resvg = new Resvg(svg);
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return new Response(pngBuffer as any, {
    headers: {
      "Content-Type": "image/png",
      /*
        Era `max-age=31536000, immutable`. Com a rota morta ninguém percebeu;
        agora que as tags Open Graph apontam para cá, "imutável por um ano"
        significaria que trocar foto, partido ou coligação nunca atualizaria o
        card — num projeto que sincroniza com o TSE 4x/dia. Um dia de CDN com
        revalidação em segundo plano acompanha a cadência do dado.
      */
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
