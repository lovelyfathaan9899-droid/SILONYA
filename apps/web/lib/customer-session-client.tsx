"use client";

import { createContext, useContext, type ReactNode } from "react";

const CustomerSessionContext = createContext(false);

/** Cheap boolean-only signal for client islands that need to know "is someone logged in" without fetching the full session (WishlistButton DB-sync, save-for-later, etc.) — fed from the server-rendered root layout via getCustomerContext(). */
export function CustomerSessionProvider({
  loggedIn,
  children,
}: {
  loggedIn: boolean;
  children: ReactNode;
}) {
  return (
    <CustomerSessionContext.Provider value={loggedIn}>{children}</CustomerSessionContext.Provider>
  );
}

export function useIsLoggedIn(): boolean {
  return useContext(CustomerSessionContext);
}
