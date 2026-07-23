import { test, expect, type Page } from "@playwright/test";

/**
 * Mobile-first UX audit (TESTING_STRATEGY.md §5). Runs the same checks
 * across every core storefront page on every configured device project
 * (see playwright.config.ts). Not a pixel-perfect design QA tool — it
 * catches the mechanical failure classes that make a page feel broken on
 * a phone: horizontal scroll, undersized touch targets, unreadable text,
 * and a missing/incorrect viewport meta tag.
 */

const PAGES: { name: string; path: string }[] = [
  { name: "Home", path: "/" },
  { name: "Collections", path: "/collections/new-arrivals" },
  { name: "Categories", path: "/categories/women" },
  { name: "Product", path: "/products/gold-vermeil-hoop-earrings" },
  { name: "Cart", path: "/cart" },
  { name: "Checkout", path: "/checkout" },
  { name: "Login", path: "/login" },
  { name: "Register", path: "/register" },
];

const MIN_TOUCH_TARGET = 24; // WCAG 2.2 SC 2.5.8 (AA) minimum
const MIN_READABLE_FONT_PX = 12;

async function getHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth - doc.clientWidth,
    };
  });
}

async function getUndersizedTargets(page: Page) {
  return page.evaluate((min) => {
    const selector = 'a, button, input, select, textarea, [role="button"]';
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const bad: { tag: string; text: string; width: number; height: number }[] = [];
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue; // not rendered
      if (rect.width < min || rect.height < min) {
        bad.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }
    return bad;
  }, MIN_TOUCH_TARGET);
}

async function getTinyText(page: Page) {
  return page.evaluate((min) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const bad = new Set<string>();
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent?.trim();
      if (text && node.parentElement) {
        const size = Number.parseFloat(window.getComputedStyle(node.parentElement).fontSize);
        if (size < min) {
          bad.add(`${node.parentElement.tagName.toLowerCase()}:"${text.slice(0, 30)}" (${size}px)`);
        }
      }
      node = walker.nextNode();
    }
    return [...bad];
  }, MIN_READABLE_FONT_PX);
}

for (const { name, path } of PAGES) {
  test(`${name} — no horizontal overflow, touch targets, readable text`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const viewportMeta = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content")
      .catch(() => null);
    expect(viewportMeta, `${name}: viewport meta tag missing`).toContain("width=device-width");

    const overflow = await getHorizontalOverflow(page);
    expect(
      overflow.overflow,
      `${name}: horizontal overflow of ${overflow.overflow}px (scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth})`,
    ).toBeLessThanOrEqual(1);

    const undersized = await getUndersizedTargets(page);
    expect(
      undersized.length,
      `${name}: ${undersized.length} touch target(s) under ${MIN_TOUCH_TARGET}px: ${JSON.stringify(undersized).slice(0, 500)}`,
    ).toBe(0);

    const tinyText = await getTinyText(page);
    expect(
      tinyText.length,
      `${name}: ${tinyText.length} text node(s) under ${MIN_READABLE_FONT_PX}px: ${tinyText.slice(0, 10).join(", ")}`,
    ).toBe(0);
  });
}
