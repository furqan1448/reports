// js/api-config.js
// نقطة الاتصال بنظام توثيق الأداء الجديد (قوقل شيت + Apps Script)
// بدل Firebase. راجعي تعليمات التركيب أعلى ملف Code-reports.gs.

// ⚠️ حطي هنا رابط الـ Web app اللي طلعلك من Google Apps Script بعد الـ Deploy
// (لازم ينتهي بـ /exec)
const API_URL = "https://script.google.com/macros/s/AKfycbzbbMSKhKA9ewkUbYHtwa8tx8N-mRGuEQANK6BC3vAtTB78doKPEAMuWD2YBuSIivwb/exec";

export async function callApi(action, data) {
  if (API_URL.indexOf("PASTE_YOUR") === 0) {
    throw new Error("لم يتم ربط الموقع بقوقل شيت بعد: عدّلي API_URL داخل js/api-config.js");
  }
  const payload = Object.assign({ action: action }, data || {});
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return res.json();
}
