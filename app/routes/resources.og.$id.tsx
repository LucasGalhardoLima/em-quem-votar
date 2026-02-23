import { CandidateService } from "~/services/candidate.server";
import type { Route } from "./+types/resources.og.$id";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.id) {
    return new Response("Not Found", { status: 404 });
  }

  const candidate = await CandidateService.getById(params.id);

  if (!candidate) {
    return new Response("Not Found", { status: 404 });
  }

  const fontData = await fetch(
    "https://github.com/google/fonts/raw/main/apache/robotoslab/RobotoSlab-Bold.ttf"
  ).then((res) => res.arrayBuffer());

  const regularFontData = await fetch(
    "https://github.com/google/fonts/raw/main/apache/robotoslab/RobotoSlab-Regular.ttf"
  ).then((res) => res.arrayBuffer());

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
