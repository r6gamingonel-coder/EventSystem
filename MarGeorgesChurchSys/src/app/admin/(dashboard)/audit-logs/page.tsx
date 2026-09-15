import { prisma } from "@/lib/prisma";
import { formatArabicDate, formatArabicTime } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";

const actionLabel: Record<string, string> = {
  CREATE: "إنشاء",
  UPDATE: "تعديل",
  DELETE: "حذف",
  PUBLISH: "نشر",
  UNPUBLISH: "إلغاء نشر",
  ARCHIVE: "أرشفة",
  RESTORE: "استعادة",
  APPROVE: "قبول",
  REJECT: "رفض",
  LOGIN: "تسجيل دخول",
  LOGOUT: "تسجيل خروج",
};

const entityLabel: Record<string, string> = {
  ACTIVITY: "فعالية",
  ACTIVITY_CATEGORY: "تصنيف",
  ALBUM: "ألبوم",
  PHOTO: "صورة",
  JOIN_REQUEST: "طلب انضمام",
  EVENT_REGISTRATION: "تسجيل حضور",
  SETTINGS: "الإعدادات",
  STORY: "قصة الأخوية",
  ADMIN: "مشرف",
  MEDIA_ASSET: "ملف وسائط",
};

export default async function AdminAuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    include: { admin: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">سجل العمليات</h1>

      {logs.length === 0 ? (
        <p className="text-brand-ink-soft">لا توجد عمليات مسجلة بعد.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-line bg-white px-4 py-3 text-sm"
            >
              <span>
                <span className="font-semibold text-brand-ink">{log.admin?.name ?? "مستخدم محذوف"}</span>{" "}
                <Badge tone="neutral">{actionLabel[log.action] ?? log.action}</Badge>{" "}
                <span className="text-brand-ink-soft">
                  {entityLabel[log.entity] ?? log.entity}
                  {log.entityName ? ` — ${log.entityName}` : ""}
                </span>
              </span>
              <span className="text-xs text-brand-ink-soft whitespace-nowrap">
                {formatArabicDate(log.createdAt)} — {formatArabicTime(log.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
