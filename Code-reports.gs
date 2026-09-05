/**
 * نظام توثيق الأداء - جمعية فرقان لتحفيظ القرآن الكريم
 * الكود الخلفي (Google Apps Script) - نسخة قوقل شيت
 *
 * كيف يشتغل النظام:
 * - كل الأقسام (١٤ قسم) تُحفظ مباشرة بهذا الشيت أول ما تعبّي الموظفة أي حقل
 *   (نفس طريقة نظام المقاصف) - قسم واحد لكل صف بشيت "التقارير"، بعمود
 *   "بيانات التقرير" كنص JSON. هذا يخلي البيانات متاحة من أي جهاز تسجّل
 *   دخول منه نفس الموظفة (جوال، لابتوب...)، مو محصورة بجهاز واحد.
 * - لما تضغط "إصدار وحفظ بقوقل شيت"، يتولّد ملف PDF بالمتصفح ويترفع هنا:
 *   يُحفظ بمجلد Google Drive، ويُسجَّل رابطه بنفس صف التقرير، وتتحدّث حالته لـ"مُصدر".
 *
 * طريقة التركيب:
 * 1) أنشئي Google Sheet جديد فاضي (منفصل تمامًا عن شيت المقاصف).
 * 2) من القائمة: Extensions > Apps Script
 * 3) احذفي أي كود موجود بالمحرر، والصقي هذا الكود كامل.
 * 4) شغلي دالة setup() مرة وحدة من القائمة أعلى المحرر.
 * 5) عبّي شيت "المستخدمات" بأسماء الموظفات وبريد/اسم دخول وكلمة مرور لكل وحدة، ودورها.
 *    القيم المسموحة بعمود "الدور": موظفة / مسؤولة الوحدة / مديرة الوحدة / مديرة القسم / إدارة التعليم
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
const REPORT_COLUMNS_ = ['المعرف', 'اسم المستخدم', 'الحالة', 'بيانات التقرير', 'تاريخ الإصدار', 'رابط PDF'];
const PDF_FOLDER_NAME_ = 'تقارير الأداء - فرقان';

/* ------------------- الإعداد الأولي ------------------- */

function setup() {
  const ss = ss_();

  const sheets = {
    'المستخدمات': ['الاسم', 'اسم المستخدم', 'كلمة المرور', 'الدور', 'القسم', 'الوحدة'],
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
      case 'uploadReportPdf': return json_(uploadReportPdf_(p));
      case 'getOrCreateDraftReport': return json_(getOrCreateDraftReport_(p));
      case 'loadReport': return json_(loadReport_(p));
      case 'saveReportSection': return json_(saveReportSection_(p));
      case 'clearReport': return json_(clearReport_(p));
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
    return String(r['اسم المستخدم']).trim().toLowerCase() === username;
  });

  if (!found) {
    return { ok: false, error: 'ما لقينا اسم المستخدم "' + p.username + '". تأكدي إنه مكتوب بالضبط نفس شيت "المستخدمات".' };
  }
  if (String(found['كلمة المرور']).trim() !== password) {
    return { ok: false, error: 'اسم المستخدم صحيح، بس كلمة المرور مو مطابقة.' };
  }

  const roleLabel = String(found['الدور'] || '').trim();
  const roleCode = ROLE_LABEL_TO_CODE_[roleLabel] || 'employee';

  return {
    ok: true,
    username: String(found['اسم المستخدم']).trim(),
    name: found['الاسم'] || '',
    role: roleCode,
    department: found['القسم'] || '',
    unit: found['الوحدة'] || ''
  };
}

/* ------------------- تخزين بيانات التقرير (كل الأقسام) بقوقل شيت -------------------
   كل موظفة لها صف واحد "نشط" بشيت "التقارير" (يتحدّد بـ"اسم المستخدم")، وفيه عمود
   "بيانات التقرير" يخزّن كل الأقسام كنص JSON واحد. هذا يخلي الحفظ مركزي بالسيرفر
   (مو بمتصفح الجهاز)، فتقدر الموظفة تفتح من أي جهاز (جوال/لابتوب) وتلقى نفس البيانات. */

function findReportRowByUsername_(username) {
  const rows = sheetToObjects_(REPORTS_SHEET_, 20);
  return rows.find(function (r) { return String(r['اسم المستخدم']).trim() === String(username).trim(); }) || null;
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
  if (!username) return { ok: false, error: 'اسم المستخدم مفقود' };

  const existing = findReportRowByUsername_(username);
  if (existing) {
    return { ok: true, reportId: existing['المعرف'], data: parseReportData_(existing['بيانات التقرير']) };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // نتأكد مرة ثانية بعد أخذ القفل تحسبًا لطلبين متزامنين لنفس الموظفة
    const doubleCheck = findReportRowByUsername_(username);
    if (doubleCheck) {
      return { ok: true, reportId: doubleCheck['المعرف'], data: parseReportData_(doubleCheck['بيانات التقرير']) };
    }
    const id = Utilities.getUuid();
    const sh = sheet_(REPORTS_SHEET_);
    appendRowByHeaders_(sh, { 'المعرف': id, 'اسم المستخدم': username, 'الحالة': 'مسودة', 'بيانات التقرير': '{}' });
    invalidateCache_(REPORTS_SHEET_);
    return { ok: true, reportId: id, data: {} };
  } finally {
    lock.releaseLock();
  }
}

function loadReport_(p) {
  const row = findReportRowById_(p.reportId);
  if (!row) return { ok: false, error: 'لا توجد بيانات محفوظة لهذا التقرير' };
  return { ok: true, data: parseReportData_(row['بيانات التقرير']), status: row['الحالة'] || 'مسودة' };
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
  sh.getRange(row._row, colIndex_(sh, 'الحالة')).setValue('مسودة');
  invalidateCache_(REPORTS_SHEET_);
  return { ok: true };
}

/* ------------------- إصدار التقرير: رفع الـ PDF وتسجيل رابطه ------------------- */

function getOrCreatePdfFolder_() {
  const folders = DriveApp.getFoldersByName(PDF_FOLDER_NAME_);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(PDF_FOLDER_NAME_);
}

function uploadReportPdf_(p) {
  const username = String(p.username || '').trim();
  if (!username) return { ok: false, error: 'اسم المستخدم مفقود' };
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
    sh.getRange(existing._row, colIndex_(sh, 'الحالة')).setValue('مُصدر');
  } else {
    // احتياط نادر: لو صار إصدار قبل ما يتسجّل صف مسودة لأي سبب
    appendRowByHeaders_(sh, {
      'المعرف': p.reportId, 'اسم المستخدم': username, 'الحالة': 'مُصدر',
      'بيانات التقرير': '{}', 'تاريخ الإصدار': now, 'رابط PDF': pdfUrl
    });
  }
  invalidateCache_(REPORTS_SHEET_);

  return { ok: true, pdfUrl: pdfUrl };
}
