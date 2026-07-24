// SILONYA design system (DESIGN_SYSTEM.md §3 — Primitive → Pattern → Section → Template).
// Templates live in apps/*/app, not here.

export { cn } from "./lib/cn";

// Icons (DESIGN_SYSTEM.md §2.5)
export { Icon, type IconProps } from "./icons";

// Layout primitives
export { Container, type ContainerProps } from "./layout";
export { Section, type SectionProps } from "./layout";
export { Grid, type GridProps } from "./layout";

// Theme (light/dark architecture)
export { ThemeProvider, useTheme, ThemeScript, ThemeToggle } from "./theme";
export { THEME_STORAGE_KEY, THEMES, type Theme } from "./theme";

// Motion system
export { fadeIn, fadeInUp, scaleIn, staggerChildren, Reveal, type RevealProps } from "./motion";

// Primitives
export { Button, type ButtonProps } from "./primitives/Button";
export { Input, type InputProps } from "./primitives/Input";
export { Label } from "./primitives/Label";
export { Checkbox } from "./primitives/Checkbox";
export { Textarea, type TextareaProps } from "./primitives/Textarea";
export { Badge, type BadgeProps } from "./primitives/Badge";
export { DataTable, type DataTableProps, type DataTableColumn } from "./primitives/DataTable";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
} from "./primitives/Card";
export { Breadcrumbs, type BreadcrumbsProps, type BreadcrumbItem } from "./primitives/Breadcrumbs";
export { MobileDrawer, type MobileDrawerProps } from "./primitives/MobileDrawer";
export { ConfirmDialog, type ConfirmDialogProps } from "./primitives/ConfirmDialog";
export { Skeleton, type SkeletonProps } from "./primitives/Skeleton";
export { Spinner, type SpinnerProps } from "./primitives/Spinner";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./primitives/Dialog";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "./primitives/Select";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./primitives/Tabs";
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./primitives/Accordion";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./primitives/DropdownMenu";
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  type ToastRootProps,
} from "./primitives/Toast";
export { Toaster } from "./primitives/Toaster";
export { toast, useToast, dismissToast, type ToastOptions } from "./primitives/useToast";

// Patterns
export { EmptyState, type EmptyStateProps } from "./patterns";
export { ErrorState, type ErrorStateProps } from "./patterns";
export { LoadingState, type LoadingStateProps } from "./patterns";
export { PriceDisplay, type PriceDisplayProps } from "./patterns";
export { StockStatus, type StockStatusProps } from "./patterns";
export { SizeSelector, type SizeSelectorProps, type SizeOption } from "./patterns";
export { ColorSelector, type ColorSelectorProps, type ColorOption } from "./patterns";
export { WishlistButton, type WishlistButtonProps } from "./patterns";
export { ProductCard, type ProductCardProps } from "./patterns";
export { ProductGallery, type ProductGalleryProps } from "./patterns/ProductGallery";
export { Wordmark, type WordmarkProps } from "./patterns/Wordmark";

// Sections
export {
  Header,
  type HeaderProps,
  type NavItem,
  type NavColumn,
  type NavLink,
  Footer,
  type FooterProps,
  type FooterLinkColumn,
  type FooterSocialLink,
  Hero,
  type HeroProps,
  CollectionCard,
  type CollectionCardProps,
  ProductGrid,
  type ProductGridProps,
  type ProductGridItem,
  PromoBanner,
  type PromoBannerProps,
  EditorialSection,
  type EditorialSectionProps,
} from "./sections";
export { CartDrawer, type CartDrawerProps, type CartDrawerLine } from "./sections/CartDrawer";
export {
  SearchPalette,
  type SearchPaletteProps,
  type SearchResult,
} from "./sections/SearchPalette";
