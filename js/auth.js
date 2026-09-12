// js/auth.js
// منطق تسجيل الدخول والتحقق من الجلسة، وربط المستخدمة بدورها
// النسخة الحالية: قوقل شيت + Google Apps Script (بدل Firebase)

import { callApi } from "./api-config.js";
import { ROLE_LANDING_PAGE, roleLabel } from "./firebase/roles.js";

const PROFILE_KEY = "furqan_profile";

// المسار الجذري لموقع النظام (يُحسب تلقائيًا من مكان ملف auth.js نفسه،
// بحيث يعمل تسجيل الدخول/الخروج بشكل صحيح سواء كان الموقع على GitHub Pages
// داخل مجلد فرعي مثل /furqan-reports/ أو على دومين مباشر)
const APP_ROOT_URL = new URL("../", import.meta.url);
function loginPageUrl() {
  return new URL("login.html", APP_ROOT_URL).href;
}

// تمنع ظهور صفحة محمية بعد تسجيل الخروج عند الضغط على زر "رجوع" في المتصفح:
// بعض المتصفحات تعيد عرض الصفحة كما كانت (من ذاكرة bfcache) بدون تنفيذ
// الكود من جديد، فتظهر البيانات القديمة رغم انتهاء الجلسة فعليًا.
// إعادة التحميل هنا تجبر الصفحة على التحقق من حالة الدخول الحقيقية من جديد.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

// تسجيل الدخول باسم المستخدم وكلمة المرور (يتحققان من شيت "المستخدمات")
export async function login(username, password) {
  const res = await callApi("login", { username, password });
  if (!res.ok) {
    throw new Error(res.error || "تعذّر تسجيل الدخول");
  }
  // نخزن بيانات الجلسة بالمتصفح فقط (sessionStorage) - تُمسح تلقائيًا
  // عند إغلاق التبويب، وتُمسح يدويًا عند تسجيل الخروج.
  const profile = {
    username: res.username,
    uid: res.username, // نفس اسم المستخدم يُستخدم كمعرّف فريد لكل موظفة
    name: res.name,
    role: res.role,
    department: res.department,
    unit: res.unit
  };
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

// تسجيل الخروج
export function logout() {
  sessionStorage.removeItem(PROFILE_KEY);
  // ملاحظة: لا نمسح مسودة التقرير المحفوظة محليًا عند الخروج - تبقى
  // موجودة بجهازك وتقدرين تكملينها بعد الدخول من جديد، لين تمسحينها
  // بنفسك عن طريق "مسح المحتوى" فقط.
  window.location.href = loginPageUrl();
}

// حماية الصفحات: يُستدعى في كل صفحة داخلية للتأكد من وجود جلسة صالحة
export function requireAuth(onReady) {
  const raw = sessionStorage.getItem(PROFILE_KEY);
  if (!raw) {
    window.location.href = loginPageUrl();
    return;
  }
  let profile;
  try {
    profile = JSON.parse(raw);
  } catch (e) {
    sessionStorage.removeItem(PROFILE_KEY);
    window.location.href = loginPageUrl();
    return;
  }
  onReady(profile);
}

// هل فيه جلسة دخول حالية؟ (تُستخدم بصفحة index.html)
export function isLoggedIn() {
  return !!sessionStorage.getItem(PROFILE_KEY);
}

// توجيه المستخدمة بعد الدخول حسب دورها
export function redirectByRole(profile) {
  const target = ROLE_LANDING_PAGE[profile.role] || "dashboard.html";
  window.location.href = target;
}

export { roleLabel };
