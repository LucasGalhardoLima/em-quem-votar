import { PrismaClient } from "@prisma/client";

const CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2";

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  return response.json();
}

async function main() {
    const voteId = '2196833-326'; // Reforma Tributária
    console.log(`fetching votes for ${voteId}...`);
    
    const response = await fetch(`${CAMARA_API}/votacoes/${voteId}/votos`);
    const data = await response.json();
    const votosAPI = data.dados;
    
    if (!votosAPI || votosAPI.length === 0) {
        console.log("No votes found in API response.");
        return;
    }

    console.log("First vote sample:", JSON.stringify(votosAPI[0], null, 2));
    
    // Check key accessing
    const first = votosAPI[0];
    const depId = String(first.deputado_.id);
    console.log(`Parsed Dep ID: ${depId}`);
    
    const prisma = new PrismaClient();
    const exists = await prisma.politician.findUnique({ where: { id: depId } });
    console.log(`Politician ${depId} exists in DB?`, !!exists);
    
    await prisma.$disconnect();
}

main();
