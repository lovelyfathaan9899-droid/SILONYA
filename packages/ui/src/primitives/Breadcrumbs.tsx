import { ChevronRight } from "lucide-react";
import { Fragment, type ElementType } from "react";
import { Icon } from "../icons/Icon";
import { cn } from "../lib/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  /** The link component to render each crumb with (e.g. next/link's `Link`) — keeps this primitive framework-navigation-agnostic. Defaults to a plain anchor. */
  linkAs?: ElementType;
}

/** WCAG-correct breadcrumb trail: <nav aria-label>, ordered list, aria-current on the active page. */
export function Breadcrumbs({ items, className, linkAs: LinkComponent = "a" }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-stone font-sans text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${String(index)}`}>
              <li className="flex items-center gap-2">
                {isLast || !item.href ? (
                  <span aria-current={isLast ? "page" : undefined} className="text-ink">
                    {item.label}
                  </span>
                ) : (
                  <LinkComponent
                    href={item.href}
                    className="hover:text-ink -mx-1 -my-2.5 inline-block px-1 py-2.5 transition-colors duration-150"
                  >
                    {item.label}
                  </LinkComponent>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className="flex items-center">
                  <Icon icon={ChevronRight} size={14} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
