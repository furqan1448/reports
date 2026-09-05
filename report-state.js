// js/report-state.js
// إدارة "التقرير الحالي" (مسودة) التي تُبنى منها كل الأقسام
//
// النموذج الحالي: كل شي يُحفظ مباشرة بقوقل شيت عبر Apps Script (بنفس طريقة
// نظام المقاصف) - ما فيه أي تخزين محلي بالجهاز (لا localStorage ولا غيره).
// بهذا الشكل تقدر الموظفة تفتح من أي جهاز (جوال، لابتوب...) بنفس حسابها
// وتلقى نفس البيانات اللي كتبتها من جهاز ثاني، لأن المصدر الوحيد هو الشيت.
//
// فيه كاش بالذاكرة فقط (يفضى تلقائيًا عند إغلاق/تحديث الصفحة) لتقليل عدد
// الطلبات المتكررة لنفس التقرير بنفس الجلسة - هذا الكاش مو تخزين دائم.

import { callApi } from "./api-config.js";

const PROFILE_KEY = "furqan_profile";

let _cachedReportId = null;
let _cachedReportData = null;

function currentUsername() {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw).username : null;
  } catch (e) {
    return null;
  }
}

// تُرجع معرّف التقرير "النشط" لهذه الموظفة (صف واحد لكل موظفة بشيت "التقارير")،
// أو تُنشئ واحد جديد فاضي إن لم يوجد. نفس المعرّف يرجع من أي جهاز تسجّل دخول
// منه نفس الموظفة، لأن البحث يصير بـ"البريد الإلكتروني" بالسيرفر مباشرة.
export async function getOrCreateDraftReport(profile) {
  const res = await callApi("getOrCreateDraftReport", { username: profile.username });
  if (!res.ok) throw new Error(res.error || "تعذّر إنشاء/جلب التقرير");
  _cachedReportId = res.reportId;
  _cachedReportData = res.data || {};
  return res.reportId;
}

export async function loadReport(reportId) {
  if (_cachedReportId === reportId && _cachedReportData) return _cachedReportData;
  const res = await callApi("loadReport", { reportId });
  if (!res.ok) return null;
  _cachedReportId = reportId;
  _cachedReportData = res.data || {};
  return _cachedReportData;
}

// حفظ بيانات قسم واحد - يُرسل مباشرة للشيت (نفس لحظة الحفظ، بدون انتظار
// حفظ باقي الأقسام)، فيوصل لأي جهاز ثاني يفتح نفس الحساب فورًا.
export async function saveSection(reportId, sectionKey, data) {
  const res = await callApi("saveReportSection", {
    reportId,
    sectionKey,
    dataJson: JSON.stringify(data === undefined ? null : data)
  });
  if (!res.ok) throw new Error(res.error || "تعذّر حفظ القسم");
  if (_cachedReportId === reportId && _cachedReportData) {
    _cachedReportData[sectionKey] = data;
  }
}

// نفس saveSection - تُستخدم للأقسام القابلة للتكرار (مصفوفات) مثل المؤشرات
export async function saveArraySection(reportId, sectionKey, arrayData) {
  return saveSection(reportId, sectionKey, arrayData);
}

// إصدار التقرير: يستقبل ملف PDF (مولَّد بالمتصفح بصفحة reports/print-report.html)
// ويرفعه لقوقل شيت، ثم يسجّل رابطه بنفس صف التقرير ويحدّث حالته لـ"مُصدر".
// لا يمسح بيانات الأقسام - تبقى كما هي لين تُمسح يدويًا من لوحة التحكم.
export async function issueReport(reportId, pdfBase64, fileName) {
  const username = currentUsername();
  const res = await callApi("uploadReportPdf", {
    reportId,
    username,
    pdfBase64,
    fileName: fileName || "تقرير.pdf"
  });
  if (!res.ok) throw new Error(res.error || "تعذّر رفع التقرير");
  return res; // { ok, pdfUrl }
}

// مسح محتوى التقرير (كل الأقسام) من الشيت مباشرة - إجراء مقصود من المستخدمة فقط،
// يؤثر على كل الأجهزة لأنه يمسح المصدر نفسه بالسيرفر.
export async function clearLocalReport(reportId) {
  const res = await callApi("clearReport", { reportId });
  if (!res.ok) throw new Error(res.error || "تعذّر مسح المحتوى");
  if (_cachedReportId === reportId) _cachedReportData = {};
}

export async function hasLocalDraft(reportId) {
  const data = await loadReport(reportId);
  return !!(data && Object.keys(data).length > 0);
}
