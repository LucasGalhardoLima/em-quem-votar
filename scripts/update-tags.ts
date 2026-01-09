import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting Tag Rename Migration...");

  const updates = [
    { oldSlug: "jovem", newSlug: "novato", newName: "Novato" },
    { oldSlug: "linha-dura", newSlug: "rigoroso", newName: "Rigoroso" },
    { oldSlug: "gazeteiro", newSlug: "ausente", newName: "Ausente" },
  ];

  for (const update of updates) {
    const oldTag = await prisma.tag.findUnique({ where: { slug: update.oldSlug } });
    const targetTag = await prisma.tag.findUnique({ where: { slug: update.newSlug } });
    
    // Case 1: Target tag already exists -> MERGE
    if (oldTag && targetTag) {
        console.log(`⚠️ Both ${update.oldSlug} and ${update.newSlug} exist. Merging...`);
        
        // Update all politician links to the new tag
        const affected = await prisma.politicianTag.updateMany({
            where: { tagId: oldTag.id },
            data: { tagId: targetTag.id }
        });
        console.log(`   - Moved ${affected.count} politicians to ${update.newSlug}`);

        // Delete the old tag
        await prisma.tag.delete({ where: { id: oldTag.id } });
        console.log(`   - Deleted old tag ${update.oldSlug}`);
    } 
    // Case 2: Only old tag exists -> RENAME
    else if (oldTag && !targetTag) {
        console.log(`found ${update.oldSlug}, renaming to ${update.newSlug}...`);
        await prisma.tag.update({
          where: { slug: update.oldSlug },
          data: {
            name: update.newName,
            slug: update.newSlug
          }
        });
        console.log(`✅ Updated ${update.oldSlug} -> ${update.newSlug}`);
    }
    // Case 3: Old tag Missing
    else if (!oldTag) {
        console.log(`ℹ️ Tag ${update.oldSlug} not found (might have been updated already).`);
    }
  }

  console.log("🏁 Migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
