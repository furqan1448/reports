// workflow.js
// مسار المراجعة والاعتماد - نسخة قوقل شيت (بدل Firebase)
//
// كل شي يُحفظ ويُقرأ مباشرة من شيت "التقارير" عبر Apps Script (نفس طريقة
// report-state.js). التحقق من صلاحية الاعتماد والحالة التالية بعد كل اعتماد
// يصير بالسيرفر (Code-reports.gs) وليس هنا، حتى ما تقدر أي موظفة تغيّر
// حالة تقرير بتلاعب بالمتصفح.

import { callApi } from "./js/api-config.js";

/* =========================
   حالات التقرير - نفس القيم المخزّنة بعمود "الحالة" بالشيت
========================= */
export const STATUS = {
  DRAFT: "draft",
  ISSUED: "issued",
  SUBMITTED: "submitted",
  UNIT_APPROVED: "unit_approved",
  DEPT_APPROVED: "dept_approved",
  APPROVED: "approved",
  RETURNED: "returned",
  REJECTED: "rejected"
};

export const STATUS_LABELS_AR = {
  draft: "مسودة",
  issued: "مُصدر",
  submitted: "بانتظار المراجعة",
  unit_approved: "بانتظار اعتماد مديرة القسم",
  dept_approved: "بانتظار اعتماد إدارة التعليم",
  approved: "معتمد نهائيًا",
  returned: "أُعيد للتعديل",
  rejected: "مرفوض"
};

/* =========================
   إرسال التقرير للمراجعة
========================= */
export async function submitForReview(reportId, profile, reviewerEmail = "") {
  const res = await callApi("submitForReview", {
    reportId,
    username: profile?.username || "",
    name: profile?.name || "",
    role: profile?.role || "",
    reviewerEmail: String(reviewerEmail || "").trim().toLowerCase()
  });
  if (!res.ok) throw new Error(res.error || "تعذّر إرسال التقرير");
  return { reportId, reviewerEmail: res.reviewerEmail };
}

/* =========================
   اعتماد التقرير
========================= */
export async function approveReport(reportId, profile, note = "") {
  const res = await callApi("approveReport", {
    reportId,
    username: profile?.username || "",
    name: profile?.name || "",
    role: profile?.role || "",
    note: note || ""
  });
  if (!res.ok) throw new Error(res.error || "تعذّر اعتماد التقرير");
}

/* =========================
   إعادة التقرير للتعديل
========================= */
export async function returnForEdit(reportId, profile, note = "") {
  const res = await callApi("returnForEdit", {
    reportId,
    username: profile?.username || "",
    name: profile?.name || "",
    role: profile?.role || "",
    note: note || ""
  });
  if (!res.ok) throw new Error(res.error || "تعذّر إعادة التقرير للتعديل");
}

/* =========================
   رفض التقرير
========================= */
export async function rejectReport(reportId, profile, note = "") {
  const res = await callApi("rejectReport", {
    reportId,
    username: profile?.username || "",
    name: profile?.name || "",
    role: profile?.role || "",
    note: note || ""
  });
  if (!res.ok) throw new Error(res.error || "تعذّر رفض التقرير");
}

/* =========================
   التقارير المنتظرة اعتماد دور معيّن
========================= */
export async function listReportsPendingForRole(role) {
  const res = await callApi("listReportsPendingForRole", { role });
  if (!res.ok) return [];
  return res.reports || [];
}

/* =========================
   كل التقارير المرئية للمستخدمة الحالية
   (إدارة التعليم: الكل، غيرها: تقريرها + أي تقرير أُرسل لها كمراجعة)
========================= */
export async function listVisibleReports(profile) {
  const res = await callApi("listVisibleReports", {
    username: profile?.username || "",
    role: profile?.role || ""
  });
  if (!res.ok) return [];
  return res.reports || [];
}

/* =========================
   عدد التقارير حسب كل حالة (لوحة إحصائيات إدارة التعليم)
========================= */
export async function getStatusCounts() {
  const res = await callApi("getStatusCounts", {});
  if (!res.ok) return {};
  return res.counts || {};
}
