import { CandidateService } from "~/services/candidate.server";
import type { Route } from "./+types/resources.og.$id";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const FONT_URLS = {
  bold: "https://github.com/google/fonts/raw/main/apache/robotoslab/RobotoSlab-Bold.ttf",
  regular:
    "https://github.com/google/fonts/raw/main/apache/robotoslab/RobotoSlab-Regular.ttf",
} as const;

/**
 * As fontes eram baixadas do GitHub a CADA requisição — duas idas à rede por
 * imagem. No pico de outubro isso é lento e, pior, frágil: se o GitHub
 * limitar ou cair, as prévias de compartilhamento quebram exatamente quando
 * mais importam.
 *
 * Memoizamos a promessa (não o resultado) para que requisições concorrentes
 * durante o cold start compartilhem o mesmo download em vez de dispararem
 * um cada. O cache vive enquanto a instância viver.
 */
let fontsPromise: Promise<{ bold: ArrayBuffer; regular: ArrayBuffer }> | null =
  null;

function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      fetch(FONT_URLS.bold).then((r) => {
        if (!r.ok) throw new Error(`fonte bold: HTTP ${r.status}`);
        return r.arrayBuffer();
      }),
      fetch(FONT_URLS.regular).then((r) => {
        if (!r.ok) throw new Error(`fonte regular: HTTP ${r.status}`);
        return r.arrayBuffer();
      }),
    ])
      .then(([bold, regular]) => ({ bold, regular }))
      .catch((err) => {
        // Não guarda a falha: a próxima requisição tenta de novo.
        fontsPromise = null;
        throw err;
      });
  }
  return fontsPromise;
}

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.id) {
    return new Response("Not Found", { status: 404 });
  }

  const candidate = await CandidateService.getById(params.id);

  if (!candidate) {
    return new Response("Not Found", { status: 404 });
  }

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

  const svg = await satori(
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        backgroundImage: "linear-gradient(to bottom right, #DFDFDF, #e8eaf6)",
        fontFamily: '"Roboto Slab"',
        padding: "40px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "white",
          borderRadius: "40px",
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.15)",
          padding: "60px",
          alignItems: "center",
          gap: "60px",
        }}
      >
        {/* Photo */}
        <div style={{ display: "flex" }}>
          {candidate.photoUrl ? (
            <img
              src={candidate.photoUrl}
              width={400}
              height={400}
              style={{
                borderRadius: "50%",
                objectFit: "cover",
                border: "10px solid #DFDFDF",
              }}
            />
          ) : (
            <div
              style={{
                width: 400,
                height: 400,
                borderRadius: "50%",
                backgroundColor: "#DFDFDF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "150px",
                color: "#5a5a5a",
              }}
            >
              ?
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            flex: 1,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: "32px",
                color: "#5a5a5a",
                fontWeight: 400,
                marginBottom: "8px",
              }}
            >
              Em Quem Votar?
            </div>
            <div
              style={{
                fontSize: "70px",
                color: "#343434",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {candidate.displayName}
            </div>
            <div
              style={{
                fontSize: "40px",
                color: "#0E34A0",
                fontWeight: 400,
                marginTop: "10px",
              }}
            >
              {candidate.party}
              {candidate.coalition && ` · ${candidate.coalition}`}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              width: "100%",
              height: "4px",
              backgroundColor: "#DFDFDF",
              margin: "20px 0",
            }}
          ></div>

          {/* Tags */}
          {candidate.tags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  color: "#5a5a5a",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontWeight: 700,
                }}
              >
                Posicionamentos
              </div>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}
              >
                {candidate.tags.slice(0, 5).map((tag: any) => (
                  <div
                    key={tag.slug}
                    style={{
                      display: "flex",
                      backgroundColor: "#2F3061",
                      color: "white",
                      fontSize: "30px",
                      padding: "12px 30px",
                      borderRadius: "20px",
                      fontWeight: 700,
                    }}
                  >
                    {tag.name}
                  </div>
                ))}
              </div>
            </div>
          )}
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
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
