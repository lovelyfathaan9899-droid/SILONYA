"use client";

import { useState } from "react";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { Input } from "./Input";
import { Label } from "./Label";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Button label for the destructive action, e.g. "Delete product". */
  confirmLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  /**
   * When set, the confirm button stays disabled until the admin types this
   * exact word into a text field — the "type DELETE to confirm" pattern for
   * the highest-blast-radius actions (permanent-feeling deletes, bulk
   * operations). Omit for lower-stakes confirmations (a plain Cancel/Confirm
   * pair is enough there).
   */
  requireTypedWord?: string;
}

/** Shared destructive-action confirmation — every "type X to confirm" or plain confirm/cancel dialog in the admin should go through this one component rather than each page rolling its own. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending = false,
  requireTypedWord,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const locked = requireTypedWord !== undefined && typed !== requireTypedWord;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {requireTypedWord ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-dialog-typed-word">
              Type <span className="text-ink font-medium">{requireTypedWord}</span> to confirm
            </Label>
            <Input
              id="confirm-dialog-typed-word"
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
              }}
              autoComplete="off"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button variant="destructive" disabled={locked || isPending} onClick={onConfirm}>
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
