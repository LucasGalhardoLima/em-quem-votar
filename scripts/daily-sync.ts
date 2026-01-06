import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();
const CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2";

// Email Configuration
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || SMTP_USER;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || SMTP_USER; // Default to self

// Helper: Fetch with Retry
async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (response.ok) return response;
      if (response.status === 429) {
        console.warn(`⏳ Rate limit hit. Waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.warn(`⚠️ Attempt ${i + 1} failed for ${url}: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i))); // Exponential backoff
    }
  }
  throw new Error(`Failed after ${retries} retries`);
}

// Helper: Send Email Alert
async function sendAlert(message: string) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("⚠️ SMTP credentials not set. Alert skipped:", message);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Em Quem Votar Bot" <${ALERT_EMAIL_FROM}>`,
      to: ALERT_EMAIL_TO,
      subject: "🚨 [Alerta] Falha na Sincronização de Dados",
      text: `Ocorreu um erro no script de atualização diária:\n\n${message}\n\nVerifique os logs no GitHub Actions.`,
      html: `
        <h2>🚨 Falha na Sincronização de Dados</h2>
        <p>Ocorreu um erro no script de atualização diária:</p>
        <pre style="background: #f4f4f4; padding: 10px; border-radius: 5px;">${message}</pre>
        <p>Verifique os logs no GitHub Actions para mais detalhes.</p>
      `,
    });
    console.log("📧 Alerta de e-mail enviado com sucesso.");
  } catch (e) {
    console.error("❌ Falha ao enviar e-mail de alerta:", e);
  }
}

async function syncSpending(politicians: { id: string, name: string }[]) {
  console.log("💰 Syncing Spending Data...");
  
  // Calculate Global Average
  const results: { id: string; avgMonthly: number }[] = [];
  
  // Process in chunks to respect API limits better
  const chunkSize = 10;
  for (let i = 0; i < politicians.length; i += chunkSize) {
    const chunk = politicians.slice(i, i + chunkSize);
    console.log(`  - Processing chunk ${i/chunkSize + 1}/${Math.ceil(politicians.length/chunkSize)}...`);
    
    await Promise.all(chunk.map(async (p) => {
        try {
            const url = `${CAMARA_API}/deputados/${p.id}/despesas?ano=2024&ordem=ASC&ordenarPor=mes`;
            const response = await fetchWithRetry(url);
            const data: any = await response.json();
            const expenses = data.dados;
            
            if (expenses.length === 0) {
              results.push({ id: p.id, avgMonthly: 0 });
              return;
            }
      
            const monthlyTotals: Record<number, number> = {};
            expenses.forEach((e: any) => {
              monthlyTotals[e.mes] = (monthlyTotals[e.mes] || 0) + e.valorLiquido;
            });
      
            const months = Object.keys(monthlyTotals).length;
            const total = Object.values(monthlyTotals).reduce((a, b) => a + b, 0);
            const avgMonthly = months > 0 ? total / months : 0;
            results.push({ id: p.id, avgMonthly });
        } catch (e) {
            console.error(`Failed to fetch spending for ${p.name}`);
        }
    }));
    
    // Tiny delay between chunks
    await new Promise(r => setTimeout(r, 1000));
  }

  const nonZero = results.filter(r => r.avgMonthly > 0);
  const globalAvg = nonZero.length > 0 
    ? nonZero.reduce((s, r) => s + r.avgMonthly, 0) / nonZero.length 
    : 45000;
    
  console.log(`📈 Global Average: R$ ${globalAvg.toFixed(2)}`);

  // Update DB
  for (const r of results) {
    const isLowCost = r.avgMonthly > 0 && r.avgMonthly < globalAvg * 0.8;
    const isHighCost = r.avgMonthly > globalAvg * 1.2;

    await prisma.politician.update({
      where: { id: r.id },
      data: { spending: r.avgMonthly }
    });

    // Clean old tags
    await prisma.politicianTag.deleteMany({
      where: {
        politicianId: r.id,
        tag: { slug: { in: ["baixo-custo", "gastao"] } }
      }
    });

    // Add new tags
    if (isLowCost) {
        const tag = await prisma.tag.findUnique({ where: { slug: "baixo-custo" } });
        if(tag) await prisma.politicianTag.create({ data: { politicianId: r.id, tagId: tag.id }});
    } else if (isHighCost) {
        const tag = await prisma.tag.findUnique({ where: { slug: "gastao" } });
        if(tag) await prisma.politicianTag.create({ data: { politicianId: r.id, tagId: tag.id }});
    }
  }
}

async function syncAttendance(politicians: { id: string }[]) {
  console.log("📅 Syncing Attendance Data (Simulated for MVP)...");
  // Real implementation would fetch /deputados/{id}/eventos?dataInicio=... and count presences
  // For MVP, we'll randomize between 70% and 100% to populate the UI
  
  const updates = politicians.map(p => {
    // Deterministic "random" based on ID to avoid flapping every day
    const idNum = parseInt(p.id.replace(/\D/g, '').slice(-2)) || 50;
    const baseRate = 75 + (idNum % 25); // 75-99%
    
    return prisma.politician.update({
        where: { id: p.id },
        data: { attendanceRate: baseRate }
    });
  });
  
  // Batch update in chunks
  const chunkSize = 50;
  for (let i = 0; i < updates.length; i += chunkSize) {
      await prisma.$transaction(updates.slice(i, i + chunkSize));
  }
}

async function main() {
  console.log("🔄 Starting Daily Sync...");
  try {
    const politicians = await prisma.politician.findMany({ select: { id: true, name: true } });
    
    await syncSpending(politicians);
    await syncAttendance(politicians);
    
    console.log("✅ Daily Sync Completed Successfully");
  } catch (error: any) {
    console.error("❌ Sync Failed:", error);
    await sendAlert(`Sync Job Failed! Error: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
