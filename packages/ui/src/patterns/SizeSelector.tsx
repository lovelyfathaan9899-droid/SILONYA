import { cn } from "../lib/cn";

export interface SizeOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SizeSelectorProps {
  options: SizeOption[];
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

/** Unavailable sizes stay visible but unselectable (PRODUCT_SYSTEM.md §7 — never hide an out-of-stock option, it looks like a broken catalog). */
export function SizeSelector({
  options,
  value,
  onChange,
  label = "Size",
  className,
}: SizeSelectorProps) {
  return (
    <fieldset className={cn("flex flex-col gap-3", className)}>
      <legend className="text-ink font-sans text-sm">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value);
              }}
              className={cn(
                "flex h-11 min-w-11 items-center justify-center border px-3 font-sans text-sm transition-colors duration-150",
                "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                selected
                  ? "border-ink bg-ink text-white"
                  : "border-mist text-ink hover:border-ink bg-white",
                option.disabled &&
                  "border-mist text-stone hover:border-mist cursor-not-allowed line-through",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
