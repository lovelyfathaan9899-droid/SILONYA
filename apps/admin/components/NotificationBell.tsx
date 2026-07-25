"use client";

import { Badge, Button, Icon } from "@silonya/ui";
import { Archive, Bell, Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

const CATEGORIES = [
  { value: undefined, label: "All" },
  { value: "orders", label: "Orders" },
  { value: "customers", label: "Customers" },
  { value: "payments", label: "Payments" },
  { value: "inventory", label: "Inventory" },
  { value: "reviews", label: "Reviews" },
  { value: "system", label: "System" },
] as const;

/** A short two-tone beep synthesized with the Web Audio API — no external sound asset to manage/license, works the moment the page loads. */
function playNotificationSound(): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    for (const [freq, start] of [
      [880, 0],
      [1108, 0.12],
    ] as const) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.15, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.15);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + 0.16);
    }
  } catch {
    // Autoplay-policy or unsupported-browser failures are non-fatal — the visual/badge update still happened.
  }
}

function showBrowserNotification(title: string, body: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    document.hasFocus()
  ) {
    // Spec: browser notification is for when the dashboard is open but not
    // necessarily focused — skip it when the tab is already the active,
    // focused window, since the in-panel update is enough there.
    return;
  }
  new Notification(title, { body, icon: "/icon.svg" });
}

/** ADMIN NOTIFICATIONS / NOTIFICATION CENTER spec — bell icon with unread counter, live via SSE (apps/admin/app/api/notifications/stream), browser notification + sound on arrival, filter by category, mark read/archive/delete. */
export function NotificationBell() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);
  const permissionRequested = useRef(false);

  const unreadCount = trpc.adminNotifications.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const list = trpc.adminNotifications.list.useQuery({ category, limit: 30 }, { enabled: open });

  const markRead = trpc.adminNotifications.markRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.adminNotifications.list.invalidate(),
        utils.adminNotifications.unreadCount.invalidate(),
      ]);
    },
  });
  const markAllRead = trpc.adminNotifications.markAllRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.adminNotifications.list.invalidate(),
        utils.adminNotifications.unreadCount.invalidate(),
      ]);
    },
  });
  const archive = trpc.adminNotifications.archive.useMutation({
    onSuccess: async () => utils.adminNotifications.list.invalidate(),
  });
  const dismiss = trpc.adminNotifications.dismiss.useMutation({
    onSuccess: async () => utils.adminNotifications.list.invalidate(),
  });
  const markClicked = trpc.adminNotifications.markClicked.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.adminNotifications.list.invalidate(),
        utils.adminNotifications.unreadCount.invalidate(),
      ]);
    },
  });

  // Ask for browser-notification permission once, on first mount, not
  // buried behind an extra click — the admin dashboard is exactly the kind
  // of "the user clearly wants alerts from this" context that justifies
  // asking immediately rather than waiting for an explicit opt-in action.
  useEffect(() => {
    if (permissionRequested.current) return;
    permissionRequested.current = true;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.addEventListener("notification", (event: MessageEvent<string>) => {
      const notification = JSON.parse(event.data) as { title: string; body: string };
      playNotificationSound();
      showBrowserNotification(notification.title, notification.body);
      void utils.adminNotifications.unreadCount.invalidate();
      void utils.adminNotifications.list.invalidate();
    });
    // EventSource reconnects automatically on its own when the server
    // closes the stream (apps/admin/app/api/notifications/stream caps its
    // own duration well under Vercel's function limits) — no manual
    // reconnect logic needed here.
    return () => {
      source.close();
    };
  }, [utils]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const count = unreadCount.data?.count ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label={`Notifications${count > 0 ? `, ${String(count)} unread` : ""}`}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className="text-ink focus-visible:ring-ink relative flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <Icon icon={Bell} size={20} />
        {count > 0 ? (
          <span className="bg-accent absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-sans text-[10px] text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="border-mist absolute right-0 top-full z-40 mt-2 flex max-h-[32rem] w-[22rem] flex-col border bg-white shadow-lg">
          <div className="border-mist flex items-center justify-between border-b p-3">
            <p className="text-ink font-sans text-sm font-medium">Notifications</p>
            <Button
              variant="secondary"
              size="sm"
              disabled={markAllRead.isPending || count === 0}
              onClick={() => {
                markAllRead.mutate();
              }}
            >
              Mark all read
            </Button>
          </div>

          <div className="border-mist flex gap-1 overflow-x-auto border-b p-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => {
                  setCategory(c.value);
                }}
                className={`shrink-0 border px-2.5 py-1 font-sans text-xs transition-colors duration-150 ${
                  category === c.value
                    ? "border-ink bg-ink text-white"
                    : "border-mist text-ink hover:border-ink"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {list.isLoading ? (
              <p className="text-stone p-4 font-sans text-sm">Loading…</p>
            ) : (list.data?.items.length ?? 0) === 0 ? (
              <p className="text-stone p-4 font-sans text-sm">No notifications.</p>
            ) : (
              <ul>
                {list.data?.items.map((notification) => (
                  <li key={notification.id} className="border-mist border-b last:border-b-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        markClicked.mutate({ id: notification.id });
                        if (notification.linkUrl) {
                          setOpen(false);
                          router.push(notification.linkUrl);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.click();
                      }}
                      className={`flex cursor-pointer flex-col gap-1 p-3 font-sans text-sm ${
                        notification.readAt ? "" : "bg-mist/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-ink font-medium">{notification.title}</p>
                        <div className="flex shrink-0 gap-1">
                          {!notification.readAt ? (
                            <button
                              type="button"
                              aria-label="Mark as read"
                              onClick={(event) => {
                                event.stopPropagation();
                                markRead.mutate({ id: notification.id });
                              }}
                              className="text-stone hover:text-ink"
                            >
                              <Icon icon={Check} size={14} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            aria-label="Archive"
                            onClick={(event) => {
                              event.stopPropagation();
                              archive.mutate({ id: notification.id });
                            }}
                            className="text-stone hover:text-ink"
                          >
                            <Icon icon={Archive} size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete"
                            onClick={(event) => {
                              event.stopPropagation();
                              dismiss.mutate({ id: notification.id });
                            }}
                            className="text-stone hover:text-ink"
                          >
                            <Icon icon={Trash2} size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-stone">{notification.body}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{notification.category}</Badge>
                        <span className="text-stone text-xs">
                          {new Date(notification.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
