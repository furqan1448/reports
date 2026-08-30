// js/report-state.js
// إدارة "التقرير الحالي" (مسودة) التي تُبنى منها كل الأقسام
// النسخة الحالية: قوقل شيت + Google Apps Script (بدل Firestore)
// كل مستخدمة تعمل على مسودة واحدة نشطة في كل مرة، ويُحفظ معرّفها
// في sessionStorage أثناء التنقل بين الصفحات (بنفس أسلوب النسخة السابقة).

import { callApi } from "./api-config.js";

const SESSION_KEY = "furqan_active_report_id";
const PROFILE_KEY = "furqan_profile";

function currentUsername() {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw).username : null;
  } catch (e) {
    return null;
  }
}

// تُرجع معرّف مسودة نشطة للمستخدمة الحالية، أو تُنشئ واحدة جديدة إن لم توجد
export async function getOrCreateDraftReport(profile) {
  const cached = sessionStorage.getItem(SESSION_KEY);
  if (cached) {
    const res = await callApi("getReport", { reportId: cached });
    // تأكيد إضافي: التقرير المخزّن مؤقتًا يخص نفس المستخدمة الحالية فعلاً
    // (يمنع ظهور مسودة موظفة أخرى عند تبديل الحسابات بنفس الجهاز)
    if (res.ok && res.report.status === "مسودة" &&
        String(res.report.ownerUsername).trim().toLowerCase() === String(profile.username).trim().toLowerCase()) {
      return cached;
    }
    sessionStorage.removeItem(SESSION_KEY);
  }

  const res = await callApi("getOrCreateReport", { username: profile.username });
  if (!res.ok) throw new Error(res.error || "تعذّر إنشاء/جلب التقرير");
  sessionStorage.setItem(SESSION_KEY, res.reportId);
  return res.reportId;
}

export async function loadReport(reportId) {
  const res = await callApi("getReport", { reportId });
  if (!res.ok) return null;
  return res.report;
}

// حفظ بيانات قسم واحد (البيانات الأساسية / الأهداف / المؤشرات...)
export async function saveSection(reportId, sectionKey, data) {
  const res = await callApi("saveSection", {
    reportId,
    sectionKey,
    data: JSON.stringify(data),
    username: currentUsername()
  });
  if (!res.ok) throw new Error(res.error || "تعذّر الحفظ");
}

// نفس saveSection - تُستخدم للأقسام القابلة للتكرار (مصفوفات) مثل المؤشرات
export async function saveArraySection(reportId, sectionKey, arrayData) {
  return saveSection(reportId, sectionKey, arrayData);
}

export function clearActiveReport() {
  sessionStorage.removeItem(SESSION_KEY);
}
