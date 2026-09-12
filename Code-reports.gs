/**
 * نظام توثيق الأداء - جمعية فرقان لتحفيظ القرآن الكريم
 * الكود الخلفي (Google Apps Script) - نسخة قوقل شيت بالكامل (بدون Firebase)
 *
 * كيف يشتغل النظام:
 * - كل الأقسام (١٤ قسم + بيانات المركز) تُحفظ مباشرة بهذا الشيت أول ما تعبّي
 *   الموظفة أي حقل (نفس طريقة نظام المقاصف) - قسم واحد لكل صف بشيت "التقارير"،
 *   بعمود "بيانات التقرير" كنص JSON. هذا يخلي البيانات متاحة من أي جهاز تسجّل
 *   دخول منه نفس الموظفة (جوال، لابتوب...)، مو محصورة بجهاز واحد.
 * - لما تضغط "إصدار وحفظ بقوقل شيت"، يتولّد ملف PDF بالمتصفح ويترفع هنا:
 *   يُحفظ بمجلد Google Drive، ويُسجَّل رابطه بنفس صف التقرير، وتتحدّث حالته لـ"مُصدر".
 * - مسار المراجعة والاعتماد (مسودة → بانتظار مراجعة → معتمدة الوحدة → معتمدة
 *   القسم → معتمد نهائيًا) بالكامل على نفس الشيت: عمود "الحالة" يتغيّر مع كل
 *   اعتماد/إعادة/رفض، وعمود "سجل الإجراءات" يحفظ تاريخ كل إجراء كنص JSON.
 * - تسجيل الدخول بالقائمة المنسدلة (بنفس طريقة المقاصف): الإجراء
 *   getLoginOptions يرجّع أسماء الموظفات وأسماء الوحدات/المراكز لتعبئة قوائم
 *   صفحة الدخول تلقائيًا.
 *
 * طريقة التركيب:
 * 1) أنشئي Google Sheet جديد فاضي (منفصل تمامًا عن شيت المقاصف).
 * 2) من القائمة: Extensions > Apps Script
 * 3) احذفي أي كود موجود بالمحرر، والصقي هذا الكود كامل.
 * 4) شغلي دالة setup() مرة وحدة من القائمة أعلى المحرر (تقدرين تشغليها مرة
 *    ثانية بأمان بعد أي تحديث - تضيف الأعمدة الجديدة الناقصة فقط ولا تمسح شي).
 * 5) عبّي شيت "المستخدمات" باسم كل موظفة/وحدة/مركز، واسم دخول (يوضع بعمود
 *    "البريد الإلكتروني" - ما يشترط يكون إيميل حقيقي، تقدرين تكتبين أي اسم
 *    فريد)، وكلمة مرور، ودورها. الوحدات والمراكز تُضاف كصفوف عادية بنفس
 *    الشيت (نفس أي موظفة)، بس بدور "مديرة مركز" مثلًا.
 *    القيم المسموحة بعمود "الدور": موظفة / مسؤولة الوحدة / مديرة الوحدة / مديرة القسم / إدارة التعليم / مديرة مركز
 * 6) Deploy > New deployment > اختاري نوع "Web app":
 *      - Execute as: Me (حسابك) — هذا يخلي الشيت خاص تمامًا ولا يحتاج مشاركته مع أي أحد
 *      - Who has access: Anyone — عشان الموقع يقدر يوصل للرابط (هذا ما يعني إن أحد يشوف الشيت)
 * 7) انسخي رابط الـ Web app (ينتهي بـ /exec) وحطيه في ملف js/api-config.js بالموقع
 *    مكان "PASTE_YOUR_APPS_SCRIPT_URL_HERE"
 *
 * لو كان عندك نشر سابق شغال وسوّيتِ تحديث على هذا الكود:
 * Deploy > Manage deployments > ✏️ تعديل > New version > Deploy
 * (بدون كذا رابط الموقع القديم يفضل شغال بالكود القديم ولا يشوف التحديثات)
 */

const USERS_SHEET_ = 'المستخدمات';
const REPORTS_SHEET_ = 'التقارير';
const REPORT_COLUMNS_ = ['المعرف', 'البريد الإلكتروني', 'الاسم', 'القسم', 'الوحدة', 'الحالة', 'بيانات التقرير', 'البريد الإلكتروني للمراجع', 'سجل الإجراءات', 'آخر تحديث', 'تاريخ الإصدار', 'رابط PDF'];
const PDF_FOLDER_NAME_ = 'تقارير الأداء - فرقان';

/* ------------------- مسار المراجعة والاعتماد ------------------- */

const STATUS_LABELS_AR_ = {
  'draft': 'مسودة',
  'issued': 'مُصدر',
  'submitted': 'بانتظار المراجعة',
  'unit_approved': 'بانتظار اعتماد مديرة القسم',
  'dept_approved': 'بانتظار اعتماد إدارة التعليم',
  'approved': 'معتمد نهائيًا',
  'returned': 'أُعيد للتعديل',
  'rejected': 'مرفوض'
};

// أي حالة "ينتظرها" كل دور حتى تظهر بقائمة التقارير المعلّقة عنده
const STATUS_FOR_ROLE_ = {
  'unit_manager': 'submitted',
  'dept_manager': 'unit_approved',
  'education_admin': 'dept_approved'
};

// الحالة التالية بعد اعتماد كل دور
const NEXT_STATUS_ = {
  'unit_manager': 'unit_approved',
  'dept_manager': 'dept_approved',
  'education_admin': 'approved'
};

/* ------------------- الإعداد الأولي ------------------- */

function setup() {
  const ss = ss_();

  const sheets = {
    'المستخدمات': ['الاسم', 'البريد الإلكتروني', 'كلمة المرور', 'الدور', 'القسم', 'الوحدة'],
    'التقارير': REPORT_COLUMNS_
  };

  Object.keys(sheets).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(sheets[name]);
      sh.getRange(1, 1, 1, sheets[name].length).setFontWeight('bold');
      sh.setRightToLeft(true);
    } else {
      const existingHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      sheets[name].forEach(function (col) {
        if (existingHeaders.indexOf(col) === -1) {
          sh.getRange(1, sh.getLastColumn() + 1).setValue(col).setFontWeight('bold');
        }
      });
    }
  });

  const usersSheet = ss.getSheetByName('المستخدمات');
  if (usersSheet.getLastRow() === 1) {
    usersSheet.appendRow(['اسم تجريبي', 'test@furqan.org', '1234', 'موظفة', 'قسم البرامج القرآنية', 'وحدة تجريبية']);
  }

  invalidateCache_(USERS_SHEET_);
  invalidateCache_(REPORTS_SHEET_);

  const msg = 'تم إنشاء/تحديث الشيتات بنجاح. عبّي شيت "المستخدمات" بأسماء وحسابات الموظفات، ثم Deploy > Manage deployments > تعديل > New version لنشر آخر تحديث.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* راجعي الشيت مباشرة أو Execution log */ }
}

/* ------------------- خرائط الأدوار ------------------- */

const ROLE_LABEL_TO_CODE_ = {
  'موظفة': 'employee',
  'مسؤولة الوحدة': 'unit_officer',
  'مديرة الوحدة': 'unit_manager',
  'مديرة القسم': 'dept_manager',
  'إدارة التعليم': 'education_admin',
  'مديرة مركز': 'center_manager'
};

/* ------------------- أدوات عامة (كاش + قراءة/كتابة الشيت) ------------------- */

let _ss_cached = null;
function ss_() {
  if (!_ss_cached) _ss_cached = SpreadsheetApp.getActiveSpreadsheet();
  return _ss_cached;
}

function sheet_(name) {
  return ss_().getSheetByName(name);
}

function colIndex_(sh, headerName) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = headers.indexOf(headerName);
  return idx === -1 ? -1 : idx + 1;
}

function appendRowByHeaders_(sh, valuesObj) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const row = headers.map(function (h) {
    return valuesObj.hasOwnProperty(h) ? valuesObj[h] : '';
  });
  sh.appendRow(row);
}

function getCache_() {
  return CacheService.getScriptCache();
}

function invalidateCache_(name) {
  try { getCache_().remove('sheet_' + name); } catch (e) { /* تجاهل */ }
}

function sheetToObjects_(name, cacheSeconds) {
  const cache = getCache_();
  const cacheKey = 'sheet_' + name;

  try {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* تجاهل */ }

  const sh = sheet_(name);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    headers.forEach(function (h, idx) { obj[h] = data[i][idx]; });
    obj._row = i + 1;
    rows.push(obj);
  }

  try { cache.put(cacheKey, JSON.stringify(rows), cacheSeconds); } catch (e) { /* تجاهل */ }
  return rows;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return handleRequest_(e.parameter);
}

function doPost(e) {
  let params = {};
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    params = e.parameter;
  }
  return handleRequest_(params);
}

function handleRequest_(p) {
  try {
    const action = p.action;
    switch (action) {
      case 'login': return json_(login_(p));
      case 'getLoginOptions': return json_(getLoginOptions_(p));
      case 'uploadReportPdf': return json_(uploadReportPdf_(p));
      case 'getOrCreateDraftReport': return json_(getOrCreateDraftReport_(p));
      case 'loadReport': return json_(loadReport_(p));
      case 'saveReportSection': return json_(saveReportSection_(p));
      case 'clearReport': return json_(clearReport_(p));
      case 'submitForReview': return json_(submitForReview_(p));
      case 'approveReport': return json_(approveReport_(p));
      case 'returnForEdit': return json_(returnForEdit_(p));
      case 'rejectReport': return json_(rejectReport_(p));
      case 'listReportsPendingForRole': return json_(listReportsPendingForRole_(p));
      case 'listVisibleReports': return json_(listVisibleReports_(p));
      case 'getStatusCounts': return json_(getStatusCounts_(p));
      case 'listAllCenterData': return json_(listAllCenterData_(p));
      default: return json_({ ok: false, error: 'إجراء غير معروف' });
    }
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

/* ------------------- تسجيل الدخول ------------------- */

function login_(p) {
  const username = String(p.username || '').trim().toLowerCase();
  const password = String(p.password || '').trim();

  const rows = sheetToObjects_(USERS_SHEET_, 300);
  const found = rows.find(function (r) {
    return String(r['البريد الإلكتروني']).trim().toLowerCase() === username;
  });

  if (!found) {
    return { ok: false, error: 'ما لقينا اسم المستخدم "' + p.username + '" بشيت "المستخدمات". تأكدي إنه مكتوب بالضبط.' };
  }
  if (String(found['كلمة المرور']).trim() !== password) {
    return { ok: false, error: 'اسم المستخدم صحيح، بس كلمة المرور مو مطابقة.' };
  }

  const roleLabel = String(found['الدور'] || '').trim();
  const roleCode = ROLE_LABEL_TO_CODE_[roleLabel] || 'employee';

  return {
    ok: true,
    username: String(found['البريد الإلكتروني']).trim(),
    name: found['الاسم'] || '',
    role: roleCode,
    department: found['القسم'] || '',
    unit: found['الوحدة'] || ''
  };
}

/* قائمة الدخول المنسدلة - بنفس فكرة نظام المقاصف: بدل ما تكتب الموظفة أو
   الوحدة اسمها يدويًا، تختاره من قائمة جاهزة معبّاة من شيت "المستخدمات"
   مباشرة (نفس الشيت لكل أنواع الحسابات - موظفة، مسؤولة وحدة، مديرة، مركز...). */
function getLoginOptions_(p) {
  const userRows = sheetToObjects_(USERS_SHEET_, 300);
  const users = userRows
    .map(function (r) {
      return { username: String(r['البريد الإلكتروني'] || '').trim(), name: String(r['الاسم'] || '').trim() };
    })
    .filter(function (u) { return u.username && u.name; })
    .sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); });

  return { ok: true, users: users };
}

/* ------------------- تخزين بيانات التقرير (كل الأقسام) بقوقل شيت -------------------
   كل موظفة لها صف واحد "نشط" بشيت "التقارير" (يتحدّد بـ"البريد الإلكتروني")، وفيه عمود
   "بيانات التقرير" يخزّن كل الأقسام كنص JSON واحد. هذا يخلي الحفظ مركزي بالسيرفر
   (مو بمتصفح الجهاز)، فتقدر الموظفة تفتح من أي جهاز (جوال/لابتوب) وتلقى نفس البيانات. */

function findReportRowByUsername_(username) {
  const rows = sheetToObjects_(REPORTS_SHEET_, 20);
  return rows.find(function (r) { return String(r['البريد الإلكتروني']).trim().toLowerCase() === String(username).trim().toLowerCase(); }) || null;
}

function findReportRowById_(reportId) {
  const rows = sheetToObjects_(REPORTS_SHEET_, 20);
  return rows.find(function (r) { return String(r['المعرف']).trim() === String(reportId).trim(); }) || null;
}

function parseReportData_(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}

function getOrCreateDraftReport_(p) {
  const username = String(p.username || '').trim();
  if (!username) return { ok: false, error: 'البريد الإلكتروني مفقود' };

  const existing = findReportRowByUsername_(username);
  if (existing) {
    // نحدّث الاسم/القسم/الوحدة لو تغيّرت بشيت المستخدمات، عشان تبقى لوحات
    // المديرات والإدارة تعرض أحدث بيانات صحيحة بدون حاجة لإعادة إنشاء الصف
    if (p.name || p.department || p.unit) {
      const sh = sheet_(REPORTS_SHEET_);
      if (p.name) sh.getRange(existing._row, colIndex_(sh, 'الاسم')).setValue(p.name);
      if (p.department) sh.getRange(existing._row, colIndex_(sh, 'القسم')).setValue(p.department);
      if (p.unit) sh.getRange(existing._row, colIndex_(sh, 'الوحدة')).setValue(p.unit);
      invalidateCache_(REPORTS_SHEET_);
    }
    return { ok: true, reportId: existing['المعرف'], data: parseReportData_(existing['بيانات التقرير']), status: existing['الحالة'] || 'draft' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // نتأكد مرة ثانية بعد أخذ القفل تحسبًا لطلبين متزامنين لنفس الموظفة
    const doubleCheck = findReportRowByUsername_(username);
    if (doubleCheck) {
      return { ok: true, reportId: doubleCheck['المعرف'], data: parseReportData_(doubleCheck['بيانات التقرير']), status: doubleCheck['الحالة'] || 'draft' };
    }
    const id = Utilities.getUuid();
    const sh = sheet_(REPORTS_SHEET_);
    appendRowByHeaders_(sh, {
      'المعرف': id, 'البريد الإلكتروني': username, 'الاسم': p.name || '', 'القسم': p.department || '',
      'الوحدة': p.unit || '', 'الحالة': 'draft', 'بيانات التقرير': '{}', 'سجل الإجراءات': '[]', 'آخر تحديث': new Date()
    });
    invalidateCache_(REPORTS_SHEET_);
    return { ok: true, reportId: id, data: {}, status: 'draft' };
  } finally {
    lock.releaseLock();
  }
}

// تحديث عمود "آخر تحديث" لصف تقرير - يُستدعى بعد أي كتابة على الصف
function touchReportRow_(sh, row) {
  const idx = colIndex_(sh, 'آخر تحديث');
  if (idx !== -1) sh.getRange(row, idx).setValue(new Date());
}

// إضافة إجراء لسجل التقرير (عمود "سجل الإجراءات" - مصفوفة JSON)
function addHistoryEntry_(sh, row, entry) {
  const idx = colIndex_(sh, 'سجل الإجراءات');
  if (idx === -1) return;
  let history = [];
  try {
    const raw = sh.getRange(row, idx).getValue();
    history = raw ? JSON.parse(raw) : [];
  } catch (e) { history = []; }
  entry.at = new Date().toISOString();
  history.push(entry);
  sh.getRange(row, idx).setValue(JSON.stringify(history));
}

function loadReport_(p) {
  const row = findReportRowById_(p.reportId);
  if (!row) return { ok: false, error: 'لا توجد بيانات محفوظة لهذا التقرير' };
  return { ok: true, data: parseReportData_(row['بيانات التقرير']), status: row['الحالة'] || 'draft' };
}

function saveReportSection_(p) {
  if (!p.reportId) return { ok: false, error: 'معرّف التقرير مفقود' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(REPORTS_SHEET_);
    const row = findReportRowById_(p.reportId);
    if (!row) return { ok: false, error: 'التقرير غير موجود' };
    const data = parseReportData_(row['بيانات التقرير']);
    data[p.sectionKey] = JSON.parse(p.dataJson || 'null');
    sh.getRange(row._row, colIndex_(sh, 'بيانات التقرير')).setValue(JSON.stringify(data));
    touchReportRow_(sh, row._row);
    invalidateCache_(REPORTS_SHEET_);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function clearReport_(p) {
  if (!p.reportId) return { ok: false, error: 'معرّف التقرير مفقود' };
  const sh = sheet_(REPORTS_SHEET_);
  const row = findReportRowById_(p.reportId);
  if (!row) return { ok: false, error: 'التقرير غير موجود' };
  sh.getRange(row._row, colIndex_(sh, 'بيانات التقرير')).setValue('{}');
  sh.getRange(row._row, colIndex_(sh, 'الحالة')).setValue('draft');
  touchReportRow_(sh, row._row);
  invalidateCache_(REPORTS_SHEET_);
  return { ok: true };
}

/* ------------------- مسار المراجعة والاعتماد ------------------- */

function submitForReview_(p) {
  if (!p.reportId) return { ok: false, error: 'معرّف التقرير مفقود' };
  const email = String(p.reviewerEmail || '').trim().toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(REPORTS_SHEET_);
    const row = findReportRowById_(p.reportId);
    if (!row) return { ok: false, error: 'التقرير غير موجود' };
    sh.getRange(row._row, colIndex_(sh, 'الحالة')).setValue('submitted');
    if (email) sh.getRange(row._row, colIndex_(sh, 'البريد الإلكتروني للمراجع')).setValue(email);
    addHistoryEntry_(sh, row._row, { action: 'submit', by: p.name || p.username || '', role: p.role || '', reviewerEmail: email, note: '' });
    touchReportRow_(sh, row._row);
    invalidateCache_(REPORTS_SHEET_);
    return { ok: true, reviewerEmail: email };
  } finally {
    lock.releaseLock();
  }
}

function approveReport_(p) {
  if (!p.reportId) return { ok: false, error: 'معرّف التقرير مفقود' };
  const nextStatus = NEXT_STATUS_[p.role];
  if (!nextStatus) return { ok: false, error: 'هذا الدور لا يملك صلاحية الاعتماد' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(REPORTS_SHEET_);
    const row = findReportRowById_(p.reportId);
    if (!row) return { ok: false, error: 'التقرير غير موجود' };
    sh.getRange(row._row, colIndex_(sh, 'الحالة')).setValue(nextStatus);
    addHistoryEntry_(sh, row._row, { action: 'approve', by: p.name || p.username || '', role: p.role || '', note: p.note || '' });
    touchReportRow_(sh, row._row);
    invalidateCache_(REPORTS_SHEET_);
    return { ok: true, status: nextStatus };
  } finally {
    lock.releaseLock();
  }
}

function returnForEdit_(p) {
  if (!p.reportId) return { ok: false, error: 'معرّف التقرير مفقود' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(REPORTS_SHEET_);
    const row = findReportRowById_(p.reportId);
    if (!row) return { ok: false, error: 'التقرير غير موجود' };
    sh.getRange(row._row, colIndex_(sh, 'الحالة')).setValue('returned');
    addHistoryEntry_(sh, row._row, { action: 'return', by: p.name || p.username || '', role: p.role || '', note: p.note || '' });
    touchReportRow_(sh, row._row);
    invalidateCache_(REPORTS_SHEET_);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function rejectReport_(p) {
  if (!p.reportId) return { ok: false, error: 'معرّف التقرير مفقود' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(REPORTS_SHEET_);
    const row = findReportRowById_(p.reportId);
    if (!row) return { ok: false, error: 'التقرير غير موجود' };
    sh.getRange(row._row, colIndex_(sh, 'الحالة')).setValue('rejected');
    addHistoryEntry_(sh, row._row, { action: 'reject', by: p.name || p.username || '', role: p.role || '', note: p.note || '' });
    touchReportRow_(sh, row._row);
    invalidateCache_(REPORTS_SHEET_);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// يحوّل صف شيت خام إلى نفس الشكل اللي كانت ترجعه صفحات فايربيس القديمة:
// { id, status, reviewerEmail, ownerName, updatedAt, history, ...كل أقسام التقرير }
function reportRowToObject_(row) {
  const data = parseReportData_(row['بيانات التقرير']);
  let history = [];
  try { history = row['سجل الإجراءات'] ? JSON.parse(row['سجل الإجراءات']) : []; } catch (e) { history = []; }
  const out = Object.assign({}, data, {
    id: row['المعرف'],
    status: row['الحالة'] || 'draft',
    reviewerEmail: row['البريد الإلكتروني للمراجع'] || '',
    ownerUsername: row['البريد الإلكتروني'] || '',
    ownerName: row['الاسم'] || '',
    department: row['القسم'] || '',
    unit: row['الوحدة'] || '',
    updatedAt: row['آخر تحديث'] || '',
    history: history
  });
  return out;
}

// التقارير المنتظرة اعتماد دور معيّن (نفس فكرة نظام المقاصف: لا تحتاج فلترة
// حسب الوحدة، كل صاحبة دور اعتماد تشوف كل التقارير الواصلة لمرحلتها)
function listReportsPendingForRole_(p) {
  const targetStatus = STATUS_FOR_ROLE_[p.role];
  if (!targetStatus) return { ok: true, reports: [] };
  const rows = sheetToObjects_(REPORTS_SHEET_, 20);
  const list = rows
    .filter(function (r) { return (r['الحالة'] || 'draft') === targetStatus; })
    .map(reportRowToObject_)
    .sort(function (a, b) { return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0); });
  return { ok: true, reports: list };
}

// كل التقارير المرئية لمستخدمة معيّنة: إدارة التعليم تشوف الكل، وغيرها تشوف
// تقريرها الخاص + أي تقرير أُرسل لها كمراجعة (بالبريد الإلكتروني)
function listVisibleReports_(p) {
  const username = String(p.username || '').trim().toLowerCase();
  const rows = sheetToObjects_(REPORTS_SHEET_, 20);
  let filtered;
  if (p.role === 'education_admin') {
    filtered = rows;
  } else {
    filtered = rows.filter(function (r) {
      const owner = String(r['البريد الإلكتروني'] || '').trim().toLowerCase();
      const reviewer = String(r['البريد الإلكتروني للمراجع'] || '').trim().toLowerCase();
      return owner === username || (reviewer && reviewer === username);
    });
  }
  const list = filtered
    .map(reportRowToObject_)
    .sort(function (a, b) { return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0); });
  return { ok: true, reports: list };
}

// عدد التقارير حسب كل حالة - للوحة إحصائيات إدارة التعليم
function getStatusCounts_(p) {
  const rows = sheetToObjects_(REPORTS_SHEET_, 20);
  const counts = {};
  rows.forEach(function (r) {
    const status = r['الحالة'] || 'draft';
    counts[status] = (counts[status] || 0) + 1;
  });
  return { ok: true, counts: counts, labels: STATUS_LABELS_AR_ };
}

// بيانات كل المراكز مجمّعة (قسم "بيانات المراكز" بلوحة إدارة التعليم) -
// centerData تُخزَّن كقسم عادي داخل بيانات كل تقرير (نفس فكرة باقي الأقسام)
function listAllCenterData_(p) {
  const rows = sheetToObjects_(REPORTS_SHEET_, 20);
  const list = rows.map(function (r) {
    const data = parseReportData_(r['بيانات التقرير']);
    const cd = data.centerData || {};
    return Object.assign({}, cd, {
      centerName: cd.centerName || r['الاسم'] || r['الوحدة'] || r['البريد الإلكتروني'],
      updatedAt: r['آخر تحديث'] || ''
    });
  }).filter(function (c) {
    return c.teachersCount != null || c.studentsCount != null || c.completersCount != null || (c.extraStats && c.extraStats.length);
  });
  return { ok: true, centers: list };
}

/* ------------------- إصدار التقرير: رفع الـ PDF وتسجيل رابطه ------------------- */

function getOrCreatePdfFolder_() {
  const folders = DriveApp.getFoldersByName(PDF_FOLDER_NAME_);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(PDF_FOLDER_NAME_);
}

function uploadReportPdf_(p) {
  const username = String(p.username || '').trim();
  if (!username) return { ok: false, error: 'البريد الإلكتروني مفقود' };
  if (!p.reportId) return { ok: false, error: 'معرّف التقرير مفقود' };
  if (!p.pdfBase64) return { ok: false, error: 'ملف الـ PDF مفقود' };

  const fileName = (p.fileName || 'تقرير.pdf').replace(/[\/\\?%*:|"<>]/g, '-');
  const bytes = Utilities.base64Decode(p.pdfBase64);
  const blob = Utilities.newBlob(bytes, 'application/pdf', fileName);

  const folder = getOrCreatePdfFolder_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const pdfUrl = file.getUrl();

  const sh = sheet_(REPORTS_SHEET_);
  const existing = findReportRowById_(p.reportId);
  const now = new Date();

  if (existing) {
    sh.getRange(existing._row, colIndex_(sh, 'رابط PDF')).setValue(pdfUrl);
    sh.getRange(existing._row, colIndex_(sh, 'تاريخ الإصدار')).setValue(now);
    // ملاحظة: لا نغيّر عمود "الحالة" هنا عمدًا - إصدار PDF إجراء مستقل عن
    // مسار المراجعة والاعتماد (تقدر الموظفة تصدّر نسخة PDF في أي وقت بغض
    // النظر عن حالة الاعتماد، فما نبي نطيح حالة اعتماد موجودة بالغلط)
    touchReportRow_(sh, existing._row);
  } else {
    // احتياط نادر: لو صار إصدار قبل ما يتسجّل صف مسودة لأي سبب
    appendRowByHeaders_(sh, {
      'المعرف': p.reportId, 'البريد الإلكتروني': username, 'الحالة': 'draft',
      'بيانات التقرير': '{}', 'سجل الإجراءات': '[]', 'آخر تحديث': now, 'تاريخ الإصدار': now, 'رابط PDF': pdfUrl
    });
  }
  invalidateCache_(REPORTS_SHEET_);

  return { ok: true, pdfUrl: pdfUrl };
}
