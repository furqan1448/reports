// js/report-state.js
// إدارة "التقرير الحالي" (مسودة) التي تُبنى منها كل الأقسام
//
// النموذج الحالي: كل شي محلي بمتصفح الجهاز (localStorage) من أول لحظة -
// ما فيه أي اتصال بقوقل شيت وأنتِ تعبّين الأقسام. البيانات تبقى محفوظة
// بجهازك لين تضغطين "إصدار التقرير": وقتها بس يتولّد ملف PDF ويترفع
// لقوقل شيت (سطر واحد فيه رابط الـ PDF)، وهذا هو الشيء الوحيد اللي
// يوصل الشيت فعليًا. البيانات المحلية ما تنمسح تلقائيًا بعد الإصدار -
// تبقى موجودة لين تضغطين "مسح المحتوى" بنفسك لبدء تقرير جديد.

import { callApi } from "./api-config.js";

const ACTIVE_REPORT_KEY = "furqan_active_report_id";
const PROFILE_KEY = "furqan_profile";
const LOCAL_PREFIX = "furqan_local_report_";

function currentUsername() {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw).username : null;
  } catch (e) {
    return null;
  }
}

function localKey(reportId) {
  return LOCAL_PREFIX + reportId;
}

function getLocalReport_(reportId) {
  if (!reportId) return null;
  try {
    const raw = localStorage.getItem(localKey(reportId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setLocalReport_(reportId, report) {
  try {
    localStorage.setItem(localKey(reportId), JSON.stringify(report));
  } catch (e) {
    console.error("تعذّر الحفظ المحلي:", e);
  }
}

function newReportId_() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  // احتياط للمتصفحات القديمة جدًا
  return "r" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

// تُرجع معرّف مسودة نشطة للمستخدمة الحالية على هذا الجهاز، أو تُنشئ
// واحدة جديدة إن لم توجد - كله محليًا وفوري بدون أي اتصال بالشبكة.
export async function getOrCreateDraftReport(profile) {
  const active = localStorage.getItem(ACTIVE_REPORT_KEY);
  if (active && getLocalReport_(active)) {
    return active;
  }

  const id = newReportId_();
  setLocalReport_(id, { id, ownerUsername: profile.username, status: "مسودة" });
  localStorage.setItem(ACTIVE_REPORT_KEY, id);
  return id;
}

export async function loadReport(reportId) {
  return getLocalReport_(reportId);
}

// حفظ بيانات قسم واحد - محليًا فقط، فوري وبدون شبكة
export async function saveSection(reportId, sectionKey, data) {
  const report = getLocalReport_(reportId) || { id: reportId, ownerUsername: currentUsername(), status: "مسودة" };
  report[sectionKey] = data;
  setLocalReport_(reportId, report);
}

// نفس saveSection - تُستخدم للأقسام القابلة للتكرار (مصفوفات) مثل المؤشرات
export async function saveArraySection(reportId, sectionKey, arrayData) {
  return saveSection(reportId, sectionKey, arrayData);
}

// إصدار التقرير: يستقبل ملف PDF (مولَّد بالمتصفح بصفحة reports/print-report.html)
// ويرفعه لقوقل شيت كملف واحد فقط، ثم يسجّل رابطه بسطر بشيت "التقارير".
// لا يمسح أي بيانات محلية - البيانات تبقى كما هي لين تُمسح يدويًا.
export async function issueReport(reportId, pdfBase64, fileName) {
  const report = getLocalReport_(reportId);
  if (!report) throw new Error("لا توجد بيانات محفوظة لهذا التقرير");

  const res = await callApi("uploadReportPdf", {
    reportId,
    username: currentUsername(),
    pdfBase64,
    fileName: fileName || "تقرير.pdf"
  });
  if (!res.ok) throw new Error(res.error || "تعذّر رفع التقرير");
  return res; // { ok, pdfUrl }
}

// مسح المحتوى المحلي يدويًا (لبدء تقرير جديد من الصفر) - إجراء مقصود من المستخدمة فقط
export function clearLocalReport(reportId) {
  try { localStorage.removeItem(localKey(reportId)); } catch (e) { /* تجاهل */ }
  const active = localStorage.getItem(ACTIVE_REPORT_KEY);
  if (active === reportId) localStorage.removeItem(ACTIVE_REPORT_KEY);
}

export function hasLocalDraft(reportId) {
  return !!getLocalReport_(reportId);
}
