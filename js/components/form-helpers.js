// js/components/form-helpers.js
// دوال مساعدة مشتركة للنماذج: عداد الأحرف، إظهار/إخفاء الحقول الشرطية، إشعار الحفظ

// تفعيل عداد أحرف على textarea مع حد أقصى
export function bindCharCounter(textareaId, counterId, maxChars) {
  const el = document.getElementById(textareaId);
  const counter = document.getElementById(counterId);
  if (!el || !counter) return;

  function update() {
    const len = el.value.length;
    counter.textContent = `${len} / ${maxChars} حرف`;
    counter.classList.toggle("text-danger", len > maxChars);
  }
  el.addEventListener("input", update);
  update();
}

// ربط قائمة منسدلة بقيمة "أخرى" تُظهر حقل نص عند اختيارها
export function bindOtherOption(selectId, otherWrapId, otherValue = "أخرى") {
  const select = document.getElementById(selectId);
  const wrap = document.getElementById(otherWrapId);
  if (!select || !wrap) return;

  function toggle() {
    const isOther = select.value === otherValue;
    wrap.classList.toggle("d-none", !isOther);
    const input = wrap.querySelector("input, textarea");
    if (input) input.required = isOther;
  }
  select.addEventListener("change", toggle);
  toggle();
}

// إظهار/إخفاء قسم كامل بناءً على قيمة عنصر آخر
export function bindConditionalSection(triggerId, sectionId, showWhen) {
  const trigger = document.getElementById(triggerId);
  const section = document.getElementById(sectionId);
  if (!trigger || !section) return;

  function toggle() {
    const val = trigger.type === "checkbox" ? trigger.checked : trigger.value;
    const shouldShow = Array.isArray(showWhen) ? showWhen.includes(val) : val === showWhen;
    section.classList.toggle("d-none", !shouldShow);
  }
  trigger.addEventListener("change", toggle);
  toggle();
}

// نسخة أبسط من attachAutosave لصفحات "القوائم القابلة للتكرار" (RepeatableList):
// بما إن كل صفحة عندها أصلاً دالة onSave() جاهزة تعرض إشعار الحفظ وتحدّث
// "آخر حفظ"، هذي الدالة بس تستدعيها تلقائيًا (بتأخير بسيط) بعد أي تعديل على
// أي حقل داخل الحاوية - بدون تكرار إشعار الحفظ مرتين.
export function attachContainerAutosave(containerEl, onSaveFn, debounceMs = 700) {
  if (!containerEl) return;
  let timer = null;
  function trigger() {
    clearTimeout(timer);
    timer = setTimeout(() => { onSaveFn(); }, debounceMs);
  }
  containerEl.addEventListener("input", trigger);
  containerEl.addEventListener("change", trigger);
}

// حفظ تلقائي فوري بمجرد ما تكتب/تختارين أي حقل بالنموذج - بنفس فكرة نظام
// المقاصف بالضبط (ما تحتاجين تدوسين زر حفظ عشان بياناتك تنحفظ، بس الزر يبقى
// موجود كتأكيد يدوي إضافي). collectFn ترجع بيانات النموذج الحالية، وsaveFn
// تحفظها (مثلًا saveSection). فيه تأخير بسيط (debounce) عشان ما يرسل طلب
// لكل حرف تكتبينه، بس ينتظر توقفك عن الكتابة نصف ثانية تقريبًا.
export function attachAutosave(formEl, collectFn, saveFn, opts = {}) {
  if (!formEl) return;
  const debounceMs = opts.debounceMs ?? 700;
  let timer = null;

  function trigger() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await saveFn(collectFn());
        showSaveToast(opts.savedMessage || "تم الحفظ تلقائيًا");
      } catch (err) {
        console.error(err);
        showSaveToast("تعذّر الحفظ التلقائي، تحققي من الإنترنت", true);
      }
    }, debounceMs);
  }

  formEl.addEventListener("input", trigger);
  formEl.addEventListener("change", trigger);
}

// شريط إشعار صغير أعلى الصفحة يظهر عند الحفظ
export function showSaveToast(message = "تم الحفظ", isError = false) {
  let toast = document.getElementById("saveToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "saveToast";
    toast.style.cssText = `
      position: fixed; top: 78px; left: 50%; transform: translateX(-50%);
      padding: 10px 22px; border-radius: 10px; font-size: 0.88rem; font-weight: 700;
      z-index: 2000; box-shadow: 0 6px 20px rgba(0,0,0,0.15); transition: opacity .3s;
    `;
    document.body.appendChild(toast);
  }
  toast.style.background = isError ? "#fdecea" : "#e8f6ee";
  toast.style.color = isError ? "#c0392b" : "#1e8e5a";
  toast.textContent = message;
  toast.style.opacity = "1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = "0"; }, 2200);
}

// حالة المؤشر التلقائية بناءً على المستهدف والمتحقق والاتجاه
export function computeIndicatorStatus(baseline, target, actual, direction) {
  if (actual === null || actual === undefined || actual === "" || isNaN(actual)) {
    return "none";
  }
  actual = Number(actual);
  target = Number(target);
  if (isNaN(target)) return "none";

  let ratio;
  if (direction === "asc") {
    ratio = target === 0 ? (actual >= 0 ? 1 : 0) : actual / target;
  } else if (direction === "desc") {
    ratio = actual === 0 ? 1 : target / actual;
  } else {
    // ضمن نطاق محدد: نعتبر المطابقة التامة هي الأفضل
    ratio = target === 0 ? 1 : 1 - Math.abs(actual - target) / Math.max(target, 1);
  }

  if (ratio >= 1) return "done";
  if (ratio >= 0.9) return "near";
  if (ratio >= 0.7) return "warn";
  return "fail";
}

export const STATUS_LABELS = {
  done: "🟢 متحقق",
  near: "🟡 قريب من المستهدف",
  warn: "🟠 يحتاج تدخلًا",
  fail: "🔴 متعثر",
  none: "⚪ لا توجد بيانات"
};

export function renderStatusPill(statusKey) {
  return `<span class="status-pill ${statusKey}">${STATUS_LABELS[statusKey]}</span>`;
}
