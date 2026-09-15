import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: "لقاء", slug: "meeting", icon: "🤝", isSystem: true },
  { name: "مهرجان", slug: "festival", icon: "🎉", isSystem: true },
  { name: "نشاط", slug: "activity", icon: "✨", isSystem: true },
  { name: "رحلة", slug: "trip", icon: "🚌", isSystem: true },
  { name: "خدمة", slug: "service", icon: "🕊️", isSystem: true },
  { name: "مناسبة", slug: "occasion", icon: "🎊", isSystem: true },
];

async function main() {
  // --- Super Admin ---
  const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@margeorges.church";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  const existingAdmin = await prisma.admin.findUnique({ where: { email } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.admin.create({
      data: { name, email, passwordHash, role: "SUPER_ADMIN" },
    });
    console.log(`✔ Super admin created: ${email}`);
  } else {
    console.log(`• Super admin already exists: ${email}`);
  }

  // --- Categories ---
  for (const [index, cat] of DEFAULT_CATEGORIES.entries()) {
    await prisma.activityCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, order: index },
    });
  }
  console.log(`✔ Seeded ${DEFAULT_CATEGORIES.length} default categories`);

  // --- Site settings (singleton) ---
  await prisma.siteSettings.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
  });
  console.log("✔ Site settings initialized");

  // --- Story page (singleton) with placeholder milestones ---
  const story = await prisma.storyPage.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
  });

  const existingMilestones = await prisma.storyMilestone.count({
    where: { storyId: story.id },
  });
  if (existingMilestones === 0) {
    await prisma.storyMilestone.createMany({
      data: [
        {
          storyId: story.id,
          title: "البداية",
          description:
            "محتوى مبدئي: كيف بدأت فكرة أخوية طريق المحبة داخل كنيسة مار كوركيس الكلدانية. يمكن تعديل هذا النص من لوحة التحكم.",
          order: 0,
        },
        {
          storyId: story.id,
          title: "المسيرة",
          description:
            "محتوى مبدئي: كيف نمت الأخوية وتوسّعت خدماتها ولقاءاتها عبر الوقت. يمكن تعديل هذا النص من لوحة التحكم.",
          order: 1,
        },
        {
          storyId: story.id,
          title: "الخدمة",
          description:
            "محتوى مبدئي: أبرز مبادرات الخدمة التي قامت بها الأخوية تجاه الكنيسة والمجتمع. يمكن تعديل هذا النص من لوحة التحكم.",
          order: 2,
        },
        {
          storyId: story.id,
          title: "اليوم",
          description:
            "محتوى مبدئي: أين تقف الأخوية اليوم، وما هي رؤيتها القادمة. يمكن تعديل هذا النص من لوحة التحكم.",
          order: 3,
        },
      ],
    });
    console.log("✔ Seeded story timeline placeholders");
  }

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
