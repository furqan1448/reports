// js/report-state.js
// إدارة "التقرير الحالي" (مسودة) التي تُبنى منها كل الأقسام
// النسخة الحالية: قوقل شيت + Google Apps Script (بدل Firestore)
// كل مستخدمة تعمل على مسودة واحدة نشطة في كل مرة، ويُحفظ معرّفها
// في sessionStorage أثناء التنقل بين الصفحات.

import { callApi } from "./api-config.js";

const SESSION_KEY = "furqan_active_report_id";
const PROFILE_KEY = "furqan_profile";

// تخزين مؤقت (بذاكرة الصفحة فقط) لآخر تقرير جلبناه، حتى لا نطلب نفس
// البيانات من الخادم مرتين بنفس تحميل الصفحة (getOrCreateDraftReport ثم
// loadReport) - هذا وحده يقلل تقريبًا نصف زمن انتظار فتح كل صفحة.
let _cachedReport = null;

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
  if (cached && _cachedReport && _cachedReport.id === cached) {
    // نفس التقرير موجود بذاكرة الصفحة من قبل بهذا التحميل - ما نحتاج طلب جديد
    return cached;
  }

  const res = await callApi("getOrCreateReport", { username: profile.username });
  if (!res.ok) throw new Error(res.error || "تعذّر إنشاء/جلب التقرير");

  // تأكيد إضافي: التقرير يخص نفس المستخدمة الحالية فعلاً
  // (يمنع ظهور مسودة موظفة أخرى عند تبديل الحسابات بنفس الجهاز)
  if (String(res.report.ownerUsername).trim().toLowerCase() !== String(profile.username).trim().toLowerCase()) {
    throw new Error("تعارض في بيانات الجلسة، سجّلي خروج ودخول من جديد");
  }

  sessionStorage.setItem(SESSION_KEY, res.reportId);
  _cachedReport = res.report;
  return res.reportId;
}

export async function loadReport(reportId) {
  if (_cachedReport && _cachedReport.id === reportId) {
    return _cachedReport;
  }
  const res = await callApi("getReport", { reportId });
  if (!res.ok) return null;
  _cachedReport = res.report;
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

  // نحدّث النسخة المخزّنة بذاكرة الصفحة حتى تبقى متوافقة مع آخر حفظ
  if (_cachedReport && _cachedReport.id === reportId) {
    _cachedReport[sectionKey] = data;
  }
}

// نفس saveSection - تُستخدم للأقسام القابلة للتكرار (مصفوفات) مثل المؤشرات
export async function saveArraySection(reportId, sectionKey, arrayData) {
  return saveSection(reportId, sectionKey, arrayData);
}

export function clearActiveReport() {
  sessionStorage.removeItem(SESSION_KEY);
  _cachedReport = null;
}
