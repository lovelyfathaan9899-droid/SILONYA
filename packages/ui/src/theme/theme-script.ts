import { THEME_STORAGE_KEY } from "./constants";

/**
 * Source for a blocking inline `<script>` rendered in the document `<head>`
 * (see ThemeScript.tsx) — sets `data-theme` on `<html>` before first paint
 * so there is no flash of the wrong theme while React hydrates. This is a
 * static string (no interpolated user input), safe to inline directly.
 */
export function themeInitScript(): string {
  return `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s==='light'||s==='dark'?s:(m?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
}
