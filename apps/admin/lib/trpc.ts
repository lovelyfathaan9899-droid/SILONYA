import type { AppRouter } from "@silonya/api";
import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";

// Client-side tRPC hooks (API_SPECIFICATION.md §2) — used by client
// components for data-heavy, interactive views (product list/edit). Cookie
// -writing mutations (login/logout) still go through Server Actions — see
// app/login/actions.ts for why.
export const trpc = createTRPCReact<AppRouter>();

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type ProductDetail = RouterOutputs["adminCatalog"]["products"]["get"];
