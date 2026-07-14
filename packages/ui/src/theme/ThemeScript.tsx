import { themeInitScript } from "./theme-script";

/**
 * Render once, as early as possible in the document `<head>` (root layout).
 * Server component — no "use client" needed, it only emits a static script tag.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />;
}
