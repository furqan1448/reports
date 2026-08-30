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
 */

/* ------------------- الإعداد الأولي ------------------- */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheets = {
    'المستخدمات': ['الاسم', 'اسم المستخدم', 'كلمة المرور', 'الدور', 'القسم', 'الوحدة'],
    'التقارير': ['المعرف', 'اسم المستخدم', 'الحالة', 'البيانات الأساسية', 'الأهداف', 'المؤشرات', 'آخر تحديث']
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

  // صف مثال - عدّليه/احذفيه وعبّي بيانات الموظفات الحقيقية
  const usersSheet = ss.getSheetByName('المستخدمات');
  if (usersSheet.getLastRow() === 1) {
    usersSheet.appendRow(['اسم تجريبي', 'test@furqan.org', '1234', 'موظفة', 'قسم البرامج القرآنية', 'وحدة تجريبية']);
  }

  SpreadsheetApp.getUi().alert('تم إنشاء الشيتات بنجاح. عبّي شيت "المستخدمات" بأسماء وحسابات الموظفات، ثم Deploy > New deployment لنشر رابط الموقع.');
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

// يقابل بين اسم القسم بالتقرير (basicData/goals/indicators...) واسم عمود شيت "التقارير"
const SECTION_COLUMN_ = {
  basicData: 'البيانات الأساسية',
  goals: 'الأهداف',
  indicators: 'المؤشرات'
};

const REPORTS_SHEET_ = 'التقارير';
const USERS_SHEET_ = 'المستخدمات';
const DRAFT_STATUS_ = 'مسودة';

/* ------------------- أدوات عامة (نفس أسلوب شيت المقاصف) ------------------- */

function sheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function colIndex_(sh, headerName) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = headers.indexOf(headerName);
  return idx === -1 ? -1 : idx + 1;
}

function sheetToObjects_(name) {
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

  const rows = sheetToObjects_(USERS_SHEET_);
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

function getOrCreateReport_(p) {
  const username = String(p.username || '').trim().toLowerCase();
  if (!username) return { ok: false, error: 'اسم المستخدم مفقود' };

  const rows = sheetToObjects_(REPORTS_SHEET_);
  const existing = rows.find(function (r) {
    return String(r['اسم المستخدم']).trim().toLowerCase() === username &&
      String(r['الحالة']).trim() === DRAFT_STATUS_;
  });
  if (existing) {
    return { ok: true, reportId: existing['المعرف'] };
  }

  const sh = sheet_(REPORTS_SHEET_);
  const id = Utilities.getUuid();
  sh.appendRow([id, p.username, DRAFT_STATUS_, '{}', '{}', '{}', new Date()]);
  return { ok: true, reportId: id };
}

function findReportRow_(reportId) {
  const rows = sheetToObjects_(REPORTS_SHEET_);
  return rows.find(function (r) { return String(r['المعرف']).trim() === String(reportId).trim(); });
}

function getReport_(p) {
  const row = findReportRow_(p.reportId);
  if (!row) return { ok: false, error: 'ما لقينا هذا التقرير' };

  return {
    ok: true,
    report: {
      id: row['المعرف'],
      ownerUsername: row['اسم المستخدم'],
      status: row['الحالة'],
      basicData: parseJsonSafe_(row['البيانات الأساسية']),
      goals: parseJsonSafe_(row['الأهداف']),
      indicators: parseJsonSafe_(row['المؤشرات'])
    }
  };
}

function saveSection_(p) {
  const row = findReportRow_(p.reportId);
  if (!row) return { ok: false, error: 'ما لقينا هذا التقرير' };

  const username = String(p.username || '').trim().toLowerCase();
  if (String(row['اسم المستخدم']).trim().toLowerCase() !== username) {
    return { ok: false, error: 'غير مخوّلة بتعديل هذا التقرير' };
  }

  const column = SECTION_COLUMN_[p.sectionKey];
  if (!column) return { ok: false, error: 'قسم غير معروف: ' + p.sectionKey };

  const sh = sheet_(REPORTS_SHEET_);
  const dataText = typeof p.data === 'string' ? p.data : JSON.stringify(p.data);
  sh.getRange(row._row, colIndex_(sh, column)).setValue(dataText);
  sh.getRange(row._row, colIndex_(sh, 'آخر تحديث')).setValue(new Date());

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
