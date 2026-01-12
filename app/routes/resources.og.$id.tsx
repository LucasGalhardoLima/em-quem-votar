import { PoliticianService } from "~/services/politician.server";
import type { Route } from "./+types/resources.og.$id";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.id) {
    return new Response("Not Found", { status: 404 });
  }

  const politician = await PoliticianService.getById(params.id);

  if (!politician) {
    return new Response("Not Found", { status: 404 });
  }

  // Fetch font data
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
        backgroundImage: 'linear-gradient(to bottom right, #DFDFDF, #e8eaf6)',
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
          {politician.photoUrl ? (
            <img
              src={politician.photoUrl}
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
                color: "#5a5a5a"
              }}
            >
              ?
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "32px", color: "#5a5a5a", fontWeight: 400, marginBottom: "8px" }}>
              Em Quem Votar?
            </div>
            <div style={{ fontSize: "70px", color: "#343434", fontWeight: 700, lineHeight: 1 }}>
              {politician.name}
            </div>
            <div style={{ fontSize: "40px", color: "#0E34A0", fontWeight: 400, marginTop: "10px" }}>
              {politician.party} • {politician.state}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: "100%", height: "4px", backgroundColor: "#DFDFDF", margin: "20px 0" }}></div>

          {/* Tags */}
          {politician.tags.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "24px", color: "#5a5a5a", textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>
                Principais Pautas
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                {politician.tags.map(pt => (
                  <div
                    key={pt.tag.id}
                    style={{
                      display: "flex",
                      backgroundColor: "#2F3061",
                      color: "white",
                      fontSize: "30px",
                      padding: "12px 30px",
                      borderRadius: "20px",
                      fontWeight: 700
                    }}
                  >
                    {pt.tag.name}
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

  /* 
   * Casting to any because the Buffer type from @resvg/resvg-js (Node Buffer) 
   * matches what the runtime expects for a Response body, even if the strict 
   * web types definitions in this project context don't fully align.
   */
  return new Response(pngBuffer as any, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
