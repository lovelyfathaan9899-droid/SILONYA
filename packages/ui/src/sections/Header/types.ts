export interface NavLink {
  label: string;
  href: string;
}

export interface NavColumn {
  heading?: string;
  links: NavLink[];
}

export interface NavItem {
  label: string;
  href?: string;
  /** Present → renders as a mega menu panel on desktop instead of a plain link. */
  columns?: NavColumn[];
}
