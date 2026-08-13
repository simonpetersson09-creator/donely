/**
 * Ten fixed colour "plugs" a category can be tagged with. Values are stored on
 * the category as the palette id, so the rendered colour can be re-themed later
 * without migrating stored data.
 */
export const CATEGORY_COLORS: { id: string; value: string }[] = [
  { id: "blue", value: "#2f5d8a" },
  { id: "teal", value: "#2e8b84" },
  { id: "green", value: "#4c8b3f" },
  { id: "lime", value: "#96a832" },
  { id: "gold", value: "#d1a13a" },
  { id: "orange", value: "#d9803f" },
  { id: "red", value: "#c2483f" },
  { id: "pink", value: "#c05a86" },
  { id: "purple", value: "#7a5aa8" },
  { id: "slate", value: "#6b7280" },
];

export function categoryColorValue(id?: string | null): string | null {
  if (!id) return null;
  return CATEGORY_COLORS.find((c) => c.id === id)?.value ?? null;
}
