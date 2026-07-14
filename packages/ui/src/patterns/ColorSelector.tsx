import { cn } from "../lib/cn";

export interface ColorOption {
  value: string;
  label: string;
  /** CSS color for the swatch dot (e.g. "#111111"). Omit to fall back to a text-only pill — we don't store real color hex values in the catalog yet. */
  swatch?: string;
  disabled?: boolean;
}

export interface ColorSelectorProps {
  options: ColorOption[];
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function ColorSelector({
  options,
  value,
  onChange,
  label = "Color",
  className,
}: ColorSelectorProps) {
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
                "flex h-11 items-center gap-2 border px-3 font-sans text-sm transition-colors duration-150",
                "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                selected
                  ? "border-ink bg-ink text-white"
                  : "border-mist text-ink hover:border-ink bg-white",
                option.disabled &&
                  "border-mist text-stone hover:border-mist cursor-not-allowed line-through",
              )}
            >
              {option.swatch ? (
                <span
                  aria-hidden="true"
                  className="border-mist h-3.5 w-3.5 shrink-0 rounded-full border"
                  style={{ backgroundColor: option.swatch }}
                />
              ) : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
