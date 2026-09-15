import { prisma } from "@/lib/prisma";
import { StoryForm } from "@/components/admin/story-form";

export default async function AdminStoryPage() {
  await prisma.storyPage.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });
  const story = await prisma.storyPage.findUniqueOrThrow({
    where: { id: "main" },
    include: { image: true, milestones: { orderBy: { order: "asc" } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">قصة الأخوية</h1>
      <StoryForm
        initial={{
          title: story.title,
          intro: story.intro,
          content: story.content,
          imageId: story.imageId,
          imageUrl: story.image?.url ?? null,
          showTimeline: story.showTimeline,
          milestones: story.milestones,
        }}
      />
    </div>
  );
}
