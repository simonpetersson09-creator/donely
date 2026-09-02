import { categoryColorValue } from "@/lib/category-colors";
import { cn } from "@/lib/utils";

/** Small colour plug shown to the left of a category name. */
export function CategoryDot({ color, className }: { color?: string | null; className?: string }) {
  const value = categoryColorValue(color);
  if (!value) return null;
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: value }}
    />
  );
}
