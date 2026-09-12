// js/components/org-data.js
// البيانات التنظيمية: الأقسام ومكاتبها ووحداتها، والأهداف الاستراتيجية/التشغيلية
//
// كل هذي القوائم تُجلب الآن من قوقل شيت مباشرة (شيتات "الأقسام والوحدات"،
// "المكاتب"، "الأهداف") بدل ما تكون مكتوبة هنا بالكود - عشان تقدرين تضيفين
// أو تعدّلين قسم/وحدة/مكتب/هدف من الشيت نفسه بدون أي تعديل بالموقع.

import { callApi } from "../api-config.js";

let _cache = null;

// تجيب كل القوائم دفعة وحدة من الشيت (وتخزّنها بالذاكرة لبقية الجلسة
// عشان ما تتكرر القراءة من الشيت كل مرة تتغيّر فيها صفحة)
export async function loadOrgData() {
  if (_cache) return _cache;
  const res = await callApi("getOrgLists", {});
  if (!res.ok) {
    throw new Error(res.error || "تعذّر تحميل القوائم من الشيت");
  }
  _cache = {
    departments: res.departments || [],
    unitsByDepartment: res.unitsByDepartment || {},
    offices: res.offices || [],
    strategicGoals: res.strategicGoals || [],
    operationalGoals: res.operationalGoals || []
  };
  return _cache;
}

// السنوات الهجرية فقط تبقى ثابتة بالكود (مجرد سنوات تقويمية، مو أسماء
// تنظيمية تحتاج تعديل من الشيت) - حدّثيها هنا يدويًا كل سنة أو سنتين
export const HIJRI_YEARS = ["1445هـ", "1446هـ", "1447هـ", "1448هـ"];
