"use client";

import type { LucideIcon } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { Icon } from "../icons/Icon";
import { Container } from "../layout/Container";
import { cn } from "../lib/cn";

export interface FooterLinkColumn {
  heading: string;
  links: { label: string; href: string }[];
}

export interface FooterSocialLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface FooterProps {
  logo: ReactNode;
  columns: FooterLinkColumn[];
  socialLinks?: FooterSocialLink[];
  legalLinks?: { label: string; href: string }[];
  copyrightHolder?: string;
  linkAs?: ElementType;
  className?: string;
}

/**
 * Premium editorial footer (DESIGN_SYSTEM.md §1 — "confident restraint"):
 * generous spacing, restrained color, no clutter. Content is fully
 * prop-driven, same reasoning as Header (TECH_STACK.md §3).
 */
export function Footer({
  logo,
  columns,
  socialLinks,
  legalLinks,
  copyrightHolder = "SILONYA",
  linkAs: LinkComponent = "a",
  className,
}: FooterProps) {
  return (
    <footer className={cn("border-mist bg-bone border-t", className)}>
      <Container>
        <div className="grid grid-cols-4 gap-8 py-12 md:py-16 lg:grid-cols-12">
          <div className="col-span-4 flex flex-col gap-4 lg:col-span-4">{logo}</div>

          {columns.map((column) => (
            <nav
              key={column.heading}
              aria-label={column.heading}
              className="col-span-2 flex flex-col gap-3 lg:col-span-2"
            >
              <p className="text-stone font-sans text-xs uppercase tracking-wide">
                {column.heading}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <LinkComponent
                      href={link.href}
                      className="text-ink hover:text-accent -mx-1 -my-2 inline-block px-1 py-2 font-sans text-sm transition-colors duration-150"
                    >
                      {link.label}
                    </LinkComponent>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-mist flex flex-col gap-4 border-t py-6 md:flex-row md:items-center md:justify-between">
          <p className="text-stone font-sans text-xs">
            © {new Date().getFullYear()} {copyrightHolder}. All rights reserved.
          </p>

          {legalLinks && legalLinks.length > 0 ? (
            <ul className="flex flex-wrap gap-4">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <LinkComponent
                    href={link.href}
                    className="text-stone hover:text-ink -mx-1 -my-2.5 inline-block px-1 py-2.5 font-sans text-xs transition-colors duration-150"
                  >
                    {link.label}
                  </LinkComponent>
                </li>
              ))}
            </ul>
          ) : null}

          {socialLinks && socialLinks.length > 0 ? (
            <ul className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <li key={social.label}>
                  <LinkComponent
                    href={social.href}
                    aria-label={social.label}
                    className="text-stone hover:text-ink flex h-9 w-9 items-center justify-center transition-colors duration-150"
                  >
                    <Icon icon={social.icon} size={18} />
                  </LinkComponent>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}
