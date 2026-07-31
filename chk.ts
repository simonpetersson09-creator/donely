import i18n from "./src/lib/i18n";
const res = (i18n as any).options.resources ?? (i18n as any).store.data;
const langs = Object.keys(res);
const base = res["sv"].translation ?? res["sv"];
const keys = Object.keys(base);
const en = res["en"].translation;
for (const l of langs) {
  const d = res[l].translation;
  const missing = keys.filter(k => !(k in d) || d[k] == null || d[k] === "");
  const extra = Object.keys(d).filter(k => !keys.includes(k));
  const sameAsEn = l !== "en" ? Object.keys(d).filter(k => d[k] === en[k] && String(d[k]).length > 3) : [];
  console.log(l, "n="+Object.keys(d).length, "missing:", missing.join(",") || "-", "| extra:", extra.join(",")||"-", "| ==en:", sameAsEn.join(",")||"-");
}
