import type {
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef, useState } from "react";
import { ChevronDown, Search, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/classNames";

type FieldDensity = "default" | "compact";

const controlBaseClass =
  "w-full rounded-card border border-line bg-canvas/55 text-sm text-text shadow-inner-soft outline-none transition duration-fluid placeholder:text-muted/70 focus:border-line-strong focus:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const controlDensityClass: Record<FieldDensity, string> = {
  compact: "min-h-10 px-3",
  default: "min-h-12 px-4",
};

type FieldShellProps = {
  id: string;
  label: string;
  icon?: LucideIcon | undefined;
  hideLabel?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
};

function FieldShell({
  id,
  label,
  icon: Icon,
  hideLabel = false,
  children,
  className,
}: FieldShellProps) {
  return (
    <label className={cn("block", className)} htmlFor={id}>
      <span
        className={cn(
          "mb-2 flex items-center gap-2 text-sm font-medium text-text",
          hideLabel && "sr-only",
        )}
      >
        {Icon ? <Icon aria-hidden="true" size={16} /> : null}
        {label}
      </span>
      {children}
    </label>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  density?: FieldDensity | undefined;
  icon?: LucideIcon | undefined;
  hideLabel?: boolean | undefined;
};

export function TextField({
  density = "default",
  id,
  label,
  icon,
  hideLabel,
  className,
  ...props
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} icon={icon} hideLabel={hideLabel}>
      <input
        id={id}
        className={cn(controlBaseClass, controlDensityClass[density], className)}
        {...props}
      />
    </FieldShell>
  );
}

export function HandleField({
  density = "default",
  id,
  label,
  icon,
  hideLabel,
  className,
  onChange,
  ...props
}: TextFieldProps) {
  const [internalValue, setInternalValue] = useState(() =>
    inputValueToString(props.defaultValue),
  );
  const valueText = inputValueToString(props.value ?? internalValue);
  const normalizedStart = valueText.trimStart();
  const showPrefix = normalizedStart.length > 0 && !normalizedStart.startsWith("@");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (props.value === undefined) {
      setInternalValue(event.currentTarget.value);
    }

    onChange?.(event);
  }

  return (
    <FieldShell id={id} label={label} icon={icon} hideLabel={hideLabel}>
      <span className="relative block">
        {showPrefix ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 select-none text-sm font-semibold text-muted/85",
              density === "compact" ? "left-3" : "left-4",
            )}
            data-testid={`${id}-prefix`}
          >
            @
          </span>
        ) : null}
        <input
          id={id}
          className={cn(
            controlBaseClass,
            controlDensityClass[density],
            showPrefix && (density === "compact" ? "pl-7" : "pl-8"),
            className,
          )}
          onChange={handleChange}
          {...props}
        />
      </span>
    </FieldShell>
  );
}

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  density?: FieldDensity | undefined;
  icon?: LucideIcon | undefined;
  hideLabel?: boolean | undefined;
};

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField(
    { density = "default", id, label, icon, hideLabel, className, ...props },
    ref,
  ) {
    return (
      <FieldShell id={id} label={label} icon={icon} hideLabel={hideLabel}>
        <textarea
          ref={ref}
          id={id}
          className={cn(
            controlBaseClass,
            controlDensityClass[density],
            density === "compact" ? "resize-none py-2 leading-5" : "resize-none py-3 leading-6",
            className,
          )}
          {...props}
        />
      </FieldShell>
    );
  },
);

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  density?: FieldDensity | undefined;
  icon?: LucideIcon | undefined;
  options: Array<string | { value: string; label: string }>;
};

export function SelectField({
  density = "default",
  id,
  label,
  icon,
  options,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} icon={icon}>
      <span className="relative block">
        <select
          id={id}
          className={cn(
            controlBaseClass,
            controlDensityClass[density],
            "appearance-none pr-11 disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        >
          {options.map((option) => {
            const value = typeof option === "string" ? option : option.value;
            const label = typeof option === "string" ? option : option.label;

            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
          size={17}
        />
      </span>
    </FieldShell>
  );
}

type SearchFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
};

export function SearchField({ id, label, className, ...props }: SearchFieldProps) {
  return (
    <label className={cn("block", className)} htmlFor={id}>
      <span className="sr-only">{label}</span>
      <span className="flex min-h-12 items-center gap-3 rounded-full border border-line bg-canvas/55 px-4 shadow-inner-soft transition duration-fluid focus-within:border-line-strong focus-within:bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        <Search aria-hidden="true" size={18} className="text-muted" />
        <input
          id={id}
          type="search"
          className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted/75"
          {...props}
        />
      </span>
    </label>
  );
}

function inputValueToString(
  value: InputHTMLAttributes<HTMLInputElement>["value"] | undefined,
): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return Array.from(value).join("");
}
