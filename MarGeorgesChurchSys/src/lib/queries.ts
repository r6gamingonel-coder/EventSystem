import { prisma } from "@/lib/prisma";
import { isPast, isToday, isUpcoming } from "@/lib/timezone";

export async function getSiteSettings() {
  const settings = await prisma.siteSettings.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
    include: { heroImage: true },
  });
  return settings;
}

export async function getStoryPage() {
  const story = await prisma.storyPage.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
    include: {
      image: true,
      milestones: { where: { isVisible: true }, orderBy: { order: "asc" } },
    },
  });
  return story;
}

const publishedActivityInclude = {
  category: true,
  coverImage: true,
  images: { include: { mediaAsset: true }, orderBy: { order: "asc" as const } },
};

export async function getTodayOrNextActivities() {
  const activities = await prisma.activity.findMany({
    where: { status: "PUBLISHED" },
    include: publishedActivityInclude,
    orderBy: { date: "asc" },
  });

  const today = activities.filter((a) => isToday(a.date));
  if (today.length > 0) {
    return { kind: "today" as const, activities: today };
  }

  const next = activities.filter((a) => isUpcoming(a.date)).slice(0, 1);
  return { kind: "next" as const, activities: next };
}

export async function getUpcomingActivities(limit = 6) {
  const activities = await prisma.activity.findMany({
    where: { status: "PUBLISHED" },
    include: publishedActivityInclude,
    orderBy: { date: "asc" },
  });
  return activities.filter((a) => isUpcoming(a.date) || isToday(a.date)).slice(0, limit);
}

export async function getPastActivities(limit = 6) {
  const activities = await prisma.activity.findMany({
    where: { status: "PUBLISHED" },
    include: publishedActivityInclude,
    orderBy: { date: "desc" },
  });
  return activities.filter((a) => isPast(a.date)).slice(0, limit);
}

export async function getFeaturedActivity() {
  return prisma.activity.findFirst({
    where: { status: "PUBLISHED", featured: true },
    include: publishedActivityInclude,
    orderBy: { date: "asc" },
  });
}

export async function getActivityBySlug(slug: string) {
  return prisma.activity.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: publishedActivityInclude,
  });
}

export async function getActivitiesForListing(categorySlug?: string) {
  const activities = await prisma.activity.findMany({
    where: {
      status: "PUBLISHED",
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: publishedActivityInclude,
    orderBy: { date: "asc" },
  });

  const upcoming = activities.filter((a) => isUpcoming(a.date) || isToday(a.date));
  const past = activities.filter((a) => isPast(a.date)).reverse();

  return { upcoming, past };
}

export async function getAllCategories() {
  return prisma.activityCategory.findMany({ orderBy: { order: "asc" } });
}

export async function getPublishedAlbums() {
  return prisma.album.findMany({
    where: { status: "PUBLISHED" },
    include: {
      coverImage: true,
      _count: { select: { photos: true } },
    },
    orderBy: { order: "asc" },
  });
}

export async function getAlbumBySlug(slug: string) {
  return prisma.album.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      photos: { include: { mediaAsset: true }, orderBy: { order: "asc" } },
    },
  });
}

export async function getGalleryPreviewPhotos(limit = 8) {
  return prisma.photo.findMany({
    where: { album: { status: "PUBLISHED" } },
    include: { mediaAsset: true, album: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
