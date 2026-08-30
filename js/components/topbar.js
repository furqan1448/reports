// js/components/topbar.js
// شريط علوي مشترك بين جميع صفحات النظام: يعرض اسم المستخدمة ودورها وزر خروج

import { logout, roleLabel } from "../auth.js";

// مسار الشعار يُحسب تلقائيًا من موقع هذا الملف نفسه بحيث يعمل بشكل صحيح
// من أي صفحة (سواء في الجذر أو داخل pages/ أو reports/)
const LOGO_URL = new URL("../../furqan-logo.png", import.meta.url).href;

export function renderTopbar(profile, options = {}) {
  const mount = document.getElementById("topbar-mount");
  if (!mount) return;

  const homeHref = options.homeHref || "../dashboard.html";

  mount.innerHTML = `
    <div class="topbar">
      <a href="${homeHref}" class="brand">
        <img src="${LOGO_URL}" alt="شعار فرقان" class="brand-logo">
        نظام توثيق الأداء - فرقان
      </a>
      <div class="d-flex align-items-center gap-2">
        <div class="user-chip">
          <i class="fa-regular fa-user"></i>
          <span>${profile.name || profile.email || ""}</span>
          <span class="role-label">· ${roleLabel(profile.role)}</span>
        </div>
        <button class="btn-logout" id="logoutBtn">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
          خروج
        </button>
      </div>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", logout);
}
