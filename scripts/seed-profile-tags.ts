import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🏷️  Seeding Profile Tags (Novato/Veterano)...");

  try {
    // 1. Get Tags
    const novatoTag = await prisma.tag.findUnique({ where: { slug: "novato" } });
    const veteranoTag = await prisma.tag.findUnique({ where: { slug: "veterano" } });

    if (!novatoTag || !veteranoTag) {
      console.error("❌ Tags 'novato' or 'veterano' not found. Run seed-politicos.ts first.");
      return;
    }

    // 2. Get all Politicians
    const politicians = await prisma.politician.findMany({ select: { id: true } });
    console.log(`ℹ️  Found ${politicians.length} politicians.`);

    const newTags = [];

    // 3. Assign Tags Probabilistically (Mock Data for UI Validation)
    // In a real scenario, this would rely on 'legislatura' data.
    for (const p of politicians) {
      const isNovato = Math.random() < 0.35; // ~35% are Novatos
      const tagId = isNovato ? novatoTag.id : veteranoTag.id;

      newTags.push({
        politicianId: p.id,
        tagId: tagId
      });
    }

    // 4. Batch Insert
    console.log(`Writing ${newTags.length} profile tags to DB...`);
    await prisma.politicianTag.createMany({
      data: newTags,
      skipDuplicates: true
    });

    console.log("✅ Profile tags seeded successfully.");

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
