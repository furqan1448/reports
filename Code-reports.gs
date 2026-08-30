/**
 * نظام توثيق الأداء - جمعية فرقان لتحفيظ القرآن الكريم
 * الكود الخلفي (Google Apps Script) - نسخة قوقل شيت
 *
 * كيف يشتغل النظام:
 * - كل الأقسام (١٤ قسم) تُملأ وتُحفظ محليًا بمتصفح الموظفة (بدون أي اتصال
 *   بهذا السكربت أثناء التعبئة - سريع جدًا).
 * - لما تضغط "إصدار وحفظ بقوقل شيت"، يتولّد ملف PDF بالمتصفح ويترفع هنا
 *   دفعة وحدة: يُحفظ بمجلد Google Drive، ويُسجَّل رابطه بسطر بشيت "التقارير".
 * - هذا السكربت ما يخزّن أي تفاصيل خام للتقرير (مؤشرات/برامج/...) إطلاقًا -
 *   فقط رابط ملف الـ PDF النهائي.
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
const REPORT_COLUMNS_ = ['المعرف', 'اسم المستخدم', 'تاريخ الإصدار', 'رابط PDF'];
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
  const rows = sheetToObjects_(REPORTS_SHEET_, 20);
  const existing = rows.find(function (r) { return String(r['المعرف']).trim() === String(p.reportId).trim(); });
  const now = new Date();

  if (existing) {
    sh.getRange(existing._row, colIndex_(sh, 'رابط PDF')).setValue(pdfUrl);
    sh.getRange(existing._row, colIndex_(sh, 'تاريخ الإصدار')).setValue(now);
  } else {
    sh.appendRow([p.reportId, username, now, pdfUrl]);
  }
  invalidateCache_(REPORTS_SHEET_);

  return { ok: true, pdfUrl: pdfUrl };
}
