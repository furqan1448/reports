// js/firebase/workflow.js
// مسار المراجعة والاعتماد مع تحديد المراجع بالبريد الإلكتروني

import { db } from "./config.js";

import {
  collection,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";


/* =========================
   حالات التقرير
========================= */

export const STATUS = {

  DRAFT: "draft",

  SUBMITTED: "submitted",

  UNIT_APPROVED: "unit_approved",

  DEPT_APPROVED: "dept_approved",

  APPROVED: "approved",

  RETURNED: "returned",

  REJECTED: "rejected"

};


/* =========================
   أسماء الحالات بالعربي
========================= */

export const STATUS_LABELS_AR = {

  draft:
    "مسودة",

  submitted:
    "بانتظار المراجعة",

  unit_approved:
    "بانتظار اعتماد مديرة القسم",

  dept_approved:
    "بانتظار اعتماد إدارة التعليم",

  approved:
    "معتمد نهائيًا",

  returned:
    "أُعيد للتعديل",

  rejected:
    "مرفوض"

};


/* =========================
   الحالات حسب الدور
========================= */

export const STATUS_FOR_ROLE = {

  unit_manager:
    STATUS.SUBMITTED,

  dept_manager:
    STATUS.UNIT_APPROVED,

  education_admin:
    STATUS.DEPT_APPROVED

};


/* =========================
   الحالة التالية بعد الاعتماد
========================= */

export const NEXT_STATUS = {

  unit_manager:
    STATUS.UNIT_APPROVED,

  dept_manager:
    STATUS.DEPT_APPROVED,

  education_admin:
    STATUS.APPROVED

};


/* =========================
   إضافة إجراء إلى سجل التقرير
========================= */

async function addHistoryEntry(
  reportId,
  entry
) {

  await updateDoc(
    doc(
      db,
      "reports",
      reportId
    ),
    {

      history:
        arrayUnion({

          ...entry,

          at:
            new Date().toISOString()

        }),

      updatedAt:
        serverTimestamp()

    }
  );

}


/* =========================
   إرسال التقرير للمراجعة
========================= */

export async function submitForReview(
  reportId,
  profile,
  reviewerEmail = ""
) {

  const email =
    String(
      reviewerEmail || ""
    )
      .trim()
      .toLowerCase();


  const updateData = {

    status:
      STATUS.SUBMITTED,

    updatedAt:
      serverTimestamp()

  };


  /*
   * حفظ بريد المراجع داخل التقرير
   */

  if (email) {

    updateData.reviewerEmail =
      email;

    updateData.reviewRequestedAt =
      serverTimestamp();

  }


  /*
   * تحديث التقرير
   */

  await updateDoc(

    doc(
      db,
      "reports",
      reportId
    ),

    updateData

  );


  /*
   * حفظ العملية في سجل التقرير
   */

  await addHistoryEntry(

    reportId,

    {

      action:
        "submit",

      by:
        profile?.name ||
        profile?.email ||
        "",

      role:
        profile?.role ||
        "",

      reviewerEmail:
        email,

      note:
        ""

    }

  );


  return {

    reportId,

    reviewerEmail:
      email

  };

}


/* =========================
   اعتماد التقرير
========================= */

export async function approveReport(
  reportId,
  profile,
  note = ""
) {

  const nextStatus =
    NEXT_STATUS[
      profile?.role
    ];


  if (!nextStatus) {

    throw new Error(
      "هذا الدور لا يملك صلاحية الاعتماد"
    );

  }


  await updateDoc(

    doc(
      db,
      "reports",
      reportId
    ),

    {

      status:
        nextStatus,

      approvedBy:
        profile?.name ||
        profile?.email ||
        "",

      approvedByEmail:
        profile?.email ||
        "",

      approvedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()

    }

  );


  await addHistoryEntry(

    reportId,

    {

      action:
        "approve",

      by:
        profile?.name ||
        profile?.email ||
        "",

      role:
        profile?.role ||
        "",

      note:
        note || ""

    }

  );

}


/* =========================
   إعادة التقرير للتعديل
========================= */

export async function returnForEdit(
  reportId,
  profile,
  note = ""
) {

  await updateDoc(

    doc(
      db,
      "reports",
      reportId
    ),

    {

      status:
        STATUS.RETURNED,

      returnedBy:
        profile?.name ||
        profile?.email ||
        "",

      returnedByEmail:
        profile?.email ||
        "",

      returnedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()

    }

  );


  await addHistoryEntry(

    reportId,

    {

      action:
        "return",

      by:
        profile?.name ||
        profile?.email ||
        "",

      role:
        profile?.role ||
        "",

      note:
        note || ""

    }

  );

}


/* =========================
   رفض التقرير
========================= */

export async function rejectReport(
  reportId,
  profile,
  note = ""
) {

  await updateDoc(

    doc(
      db,
      "reports",
      reportId
    ),

    {

      status:
        STATUS.REJECTED,

      rejectedBy:
        profile?.name ||
        profile?.email ||
        "",

      rejectedByEmail:
        profile?.email ||
        "",

      rejectedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()

    }

  );


  await addHistoryEntry(

    reportId,

    {

      action:
        "reject",

      by:
        profile?.name ||
        profile?.email ||
        "",

      role:
        profile?.role ||
        "",

      note:
        note || ""

    }

  );

}


/* =========================
   التقارير المنتظرة حسب الدور
========================= */

export async function listReportsPendingForRole(
  role
) {

  const targetStatus =
    STATUS_FOR_ROLE[role];


  if (!targetStatus) {

    return [];

  }


  const q =
    query(

      collection(
        db,
        "reports"
      ),

      where(
        "status",
        "==",
        targetStatus
      )

    );


  const snap =
    await getDocs(q);


  return snap.docs

    .map(
      d => ({

        id:
          d.id,

        ...d.data()

      })
    )

    .sort(

      (a, b) =>

        (
          b.updatedAt?.toMillis?.() ||
          0
        )

        -

        (
          a.updatedAt?.toMillis?.() ||
          0
        )

    );

}


/* =========================
   التقارير المرسلة لمراجع محدد
========================= */

export async function listReportsForReviewer(
  reviewerEmail
) {

  const email =
    String(
      reviewerEmail || ""
    )
      .trim()
      .toLowerCase();


  if (!email) {

    return [];

  }


  const q =
    query(

      collection(
        db,
        "reports"
      ),

      where(
        "reviewerEmail",
        "==",
        email
      )

    );


  const snap =
    await getDocs(q);


  return snap.docs

    .map(
      d => ({

        id:
          d.id,

        ...d.data()

      })
    )

    .sort(

      (a, b) =>

        (
          b.updatedAt?.toMillis?.() ||
          0
        )

        -

        (
          a.updatedAt?.toMillis?.() ||
          0
        )

    );

}
