/**
 * نظام توثيق الأداء - جمعية فرقان لتحفيظ القرآن الكريم
 * الكود الخلفي (Google Apps Script) - نسخة قوقل شيت
 *
 * طريقة التركيب:
 * 1) أنشئي Google Sheet جديد فاضي (منفصل تمامًا عن شيت المقاصف).
 * 2) من القائمة: Extensions > Apps Script
 * 3) احذفي أي كود موجود بالمحرر، والصقي هذا الكود كامل.
 * 4) شغلي دالة setup() مرة وحدة من القائمة أعلى المحرر
 *    (تنشئ شيت "المستخدمات" و"التقارير" بالأعمدة المطلوبة تلقائيًا).
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

/* ------------------- الإعداد الأولي ------------------- */

// ترتيب أعمدة شيت "التقارير" - كل قسم من أقسام النموذج له عمود يخزّن بياناته كنص JSON.
// إضافة قسم جديد مستقبلاً = إضافة سطر هنا + إضافة اسم العمود بمصفوفة setup().
const REPORT_COLUMNS_ = [
  'المعرف', 'اسم المستخدم', 'الحالة',
  'البيانات الأساسية', 'الأهداف', 'المؤشرات', 'الأعمال والبرامج',
  'أدوات القياس', 'تحليل النتائج', 'نقاط القوة', 'الصعوبات والتحديات',
  'فرص التحسين', 'المبادرات', 'قصص الأثر', 'التوصيات',
  'خطة الفترة القادمة', 'الشواهد',
  'آخر تحديث'
];

// الأعمدة اللي تُخزَّن كنص JSON فاضي '{}' افتراضيًا عند إنشاء تقرير جديد
// (كل أعمدة الأقسام ما عدا المعرف/اسم المستخدم/الحالة/آخر تحديث)
const JSON_COLUMNS_ = REPORT_COLUMNS_.filter(function (c) {
  return ['المعرف', 'اسم المستخدم', 'الحالة', 'آخر تحديث'].indexOf(c) === -1;
});

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
      // لو الشيت موجود من قبل بأعمدة أقل (تحديث نظام قديم)، نضيف الأعمدة الناقصة بآخر الصف
      const existingHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      sheets[name].forEach(function (col) {
        if (existingHeaders.indexOf(col) === -1) {
          sh.getRange(1, sh.getLastColumn() + 1).setValue(col).setFontWeight('bold');
        }
      });
    }
  });

  // صف مثال - عدّليه/احذفيه وعبّي بيانات الموظفات الحقيقية
  const usersSheet = ss.getSheetByName('المستخدمات');
  if (usersSheet.getLastRow() === 1) {
    usersSheet.appendRow(['اسم تجريبي', 'test@furqan.org', '1234', 'موظفة', 'قسم البرامج القرآنية', 'وحدة تجريبية']);
  }

  invalidateCache_('المستخدمات');
  invalidateReportsIndex_();

  const msg = 'تم إنشاء/تحديث الشيتات بنجاح. عبّي شيت "المستخدمات" بأسماء وحسابات الموظفات، ثم Deploy > Manage deployments > تعديل > New version لنشر آخر تحديث.';
  Logger.log(msg);
  // alert() تحتاج إن يكون الشيت نفسه مفتوح بنفس المتصفح وقت التشغيل، ولو ما كان
  // كذا يطلع خطأ "Cannot call SpreadsheetApp.getUi()". نتجاهله بأمان لأن الإعداد
  // نفسه اكتمل فعليًا - النتيجة موجودة بـ Execution log (أو افتحي الشيت وشوفيه مباشرة).
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // لا شيء - راجعي الشيت مباشرة أو Execution log بالمحرر
  }
}

/* ------------------- خرائط الأدوار والأقسام ------------------- */

// يقابل نفس المفاتيح المستخدمة في js/firebase/roles.js بالموقع
const ROLE_LABEL_TO_CODE_ = {
  'موظفة': 'employee',
  'مسؤولة الوحدة': 'unit_officer',
  'مديرة الوحدة': 'unit_manager',
  'مديرة القسم': 'dept_manager',
  'إدارة التعليم': 'education_admin',
  'مديرة مركز': 'center_manager'
};

// يقابل بين مفتاح القسم بالتقرير (sectionKey بالكود) واسم عمود شيت "التقارير"
const SECTION_COLUMN_ = {
  basicData: 'البيانات الأساسية',
  goals: 'الأهداف',
  indicators: 'المؤشرات',
  programs: 'الأعمال والبرامج',
  measurementTools: 'أدوات القياس',
  resultsAnalysis: 'تحليل النتائج',
  strengths: 'نقاط القوة',
  difficulties: 'الصعوبات والتحديات',
  improvementOpportunities: 'فرص التحسين',
  initiatives: 'المبادرات',
  impactStories: 'قصص الأثر',
  recommendations: 'التوصيات',
  nextPeriodPlan: 'خطة الفترة القادمة',
  evidence: 'الشواهد'
};

const REPORTS_SHEET_ = 'التقارير';
const USERS_SHEET_ = 'المستخدمات';
const DRAFT_STATUS_ = 'مسودة';

// مدة التخزين المؤقت (ثواني) - تقلل قراءة الشيت الكامل بكل طلب فتسرّع الموقع كثيرًا.
// شيت التقارير يتغيّر أكثر فنخليه مدة أقصر، وشيت المستخدمات شبه ثابت فنخليه أطول.
const CACHE_SECONDS_REPORTS_ = 20;
const CACHE_SECONDS_USERS_ = 300;

/* ------------------- أدوات عامة (كاش + قراءة/كتابة الشيت) ------------------- */

// نحتفظ بمرجع الشيت بمتغيّر عام بدل ما نناديه من جديد بكل دالة -
// توفير بسيط بس يجمع مع باقي التحسينات
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

// تقرأ الشيت كاملاً وتحوّله لمصفوفة كائنات {عمود: قيمة}, مع كاش مؤقت
// (بدل قراءة كل صفوف الشيت من جديد بكل طلب، وهذا هو السبب الرئيسي لبطء الموقع سابقًا)
function sheetToObjects_(name, cacheSeconds) {
  const cache = getCache_();
  const cacheKey = 'sheet_' + name;

  try {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* تجاهل أي خطأ بالكاش وأكملي القراءة العادية */ }

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

  try {
    cache.put(cacheKey, JSON.stringify(rows), cacheSeconds);
  } catch (e) { /* البيانات كبيرة جدًا على الكاش - نتجاهل ونكمل بدون تخزين مؤقت */ }

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
      case 'getOrCreateReport': return json_(getOrCreateReport_(p));
      case 'getReport': return json_(getReport_(p));
      case 'saveSection': return json_(saveSection_(p));
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

  const rows = sheetToObjects_(USERS_SHEET_, CACHE_SECONDS_USERS_);
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

/* ------------------- التقرير الحالي (مسودة كل موظفة) ------------------- */

function buildReportObject_(row) {
  const report = {
    id: row['المعرف'],
    ownerUsername: row['اسم المستخدم'],
    status: row['الحالة']
  };
  Object.keys(SECTION_COLUMN_).forEach(function (sectionKey) {
    report[sectionKey] = parseJsonSafe_(row[SECTION_COLUMN_[sectionKey]]);
  });
  return report;
}

// فهرس خفيف لشيت "التقارير": يقرأ بس ٣ أعمدة صغيرة (المعرف/اسم المستخدم/الحالة)
// بدل قراءة كل الأعمدة الـ١٨ (منها ١٤ عمود JSON ثقيل) لكل الصفوف في كل طلب.
// هذا الفهرس صغير جدًا فيبقى دايمًا تحت حد الـ١٠٠ كيلوبايت المسموح بالكاش،
// عكس محاولة تخزين الشيت كامل بأعمدته الثقيلة (اللي كانت تفشل بصمت).
function getReportsIndex_() {
  const cache = getCache_();
  const cacheKey = 'idx_' + REPORTS_SHEET_;
  try {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* تجاهل */ }

  const sh = sheet_(REPORTS_SHEET_);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const numRows = lastRow - 1;
  const ids = sh.getRange(2, colIndex_(sh, 'المعرف'), numRows, 1).getValues();
  const users = sh.getRange(2, colIndex_(sh, 'اسم المستخدم'), numRows, 1).getValues();
  const statuses = sh.getRange(2, colIndex_(sh, 'الحالة'), numRows, 1).getValues();

  const index = [];
  for (let i = 0; i < numRows; i++) {
    index.push({ id: ids[i][0], username: users[i][0], status: statuses[i][0], row: i + 2 });
  }

  try { cache.put(cacheKey, JSON.stringify(index), CACHE_SECONDS_REPORTS_); } catch (e) { /* تجاهل */ }
  return index;
}

function invalidateReportsIndex_() {
  try { getCache_().remove('idx_' + REPORTS_SHEET_); } catch (e) { /* تجاهل */ }
}

// تقرأ صف واحد محدد بكل أعمدته (يشمل بيانات الأقسام) - قراءة مستهدفة وخفيفة،
// بدل تحميل كل صفوف الشيت عشان تجيب صف واحد بس.
function getReportRowFull_(rowNumber) {
  const sh = sheet_(REPORTS_SHEET_);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const values = sh.getRange(rowNumber, 1, 1, sh.getLastColumn()).getValues()[0];
  const obj = {};
  headers.forEach(function (h, idx) { obj[h] = values[idx]; });
  obj._row = rowNumber;
  return obj;
}

// تُرجع معرّف مسودة نشطة للمستخدمة + بيانات التقرير كاملة بنفس الطلب
function getOrCreateReport_(p) {
  const username = String(p.username || '').trim().toLowerCase();
  if (!username) return { ok: false, error: 'اسم المستخدم مفقود' };

  const index = getReportsIndex_();
  const existing = index.find(function (r) {
    return String(r.username).trim().toLowerCase() === username && String(r.status).trim() === DRAFT_STATUS_;
  });
  if (existing) {
    const row = getReportRowFull_(existing.row);
    return { ok: true, reportId: existing.id, report: buildReportObject_(row) };
  }

  const sh = sheet_(REPORTS_SHEET_);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const id = Utilities.getUuid();
  const now = new Date();
  const rowValues = headers.map(function (h) {
    if (h === 'المعرف') return id;
    if (h === 'اسم المستخدم') return p.username;
    if (h === 'الحالة') return DRAFT_STATUS_;
    if (h === 'آخر تحديث') return now;
    if (JSON_COLUMNS_.indexOf(h) !== -1) return '{}';
    return '';
  });
  sh.appendRow(rowValues);
  invalidateReportsIndex_();

  const emptyRow = {};
  headers.forEach(function (h, idx) { emptyRow[h] = rowValues[idx]; });
  return { ok: true, reportId: id, report: buildReportObject_(emptyRow) };
}

function findReportIndexEntry_(reportId) {
  const index = getReportsIndex_();
  return index.find(function (r) { return String(r.id).trim() === String(reportId).trim(); });
}

function getReport_(p) {
  const entry = findReportIndexEntry_(p.reportId);
  if (!entry) return { ok: false, error: 'ما لقينا هذا التقرير' };
  const row = getReportRowFull_(entry.row);
  return { ok: true, report: buildReportObject_(row) };
}

function saveSection_(p) {
  const entry = findReportIndexEntry_(p.reportId);
  if (!entry) return { ok: false, error: 'ما لقينا هذا التقرير' };

  const username = String(p.username || '').trim().toLowerCase();
  if (String(entry.username).trim().toLowerCase() !== username) {
    return { ok: false, error: 'غير مخوّلة بتعديل هذا التقرير' };
  }

  const column = SECTION_COLUMN_[p.sectionKey];
  if (!column) return { ok: false, error: 'قسم غير معروف: ' + p.sectionKey };

  const sh = sheet_(REPORTS_SHEET_);
  const dataText = typeof p.data === 'string' ? p.data : JSON.stringify(p.data);
  sh.getRange(entry.row, colIndex_(sh, column)).setValue(dataText);
  sh.getRange(entry.row, colIndex_(sh, 'آخر تحديث')).setValue(new Date());
  // ملاحظة: ما نحتاج نُبطل فهرس التقارير هنا لأن saveSection ما يغيّر
  // المعرف/اسم المستخدم/الحالة (نفس الأعمدة المخزّنة بالفهرس) - توفير طلب كاش إضافي.

  return { ok: true };
}

function parseJsonSafe_(text) {
  try {
    if (!text) return {};
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}
