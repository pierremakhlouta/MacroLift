import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong",
  secondary: "border border-border-strong bg-surface-2 text-text hover:bg-border",
  ghost: "text-text hover:bg-surface-2",
  danger: "border border-danger/60 bg-danger-bg text-danger hover:bg-danger/20",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cx(buttonBase, buttonVariants[variant], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; loading?: boolean };

export function Button({ variant = "primary", loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...rest} />;
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

const inputClass =
  "block w-full min-h-11 rounded-xl border border-border-strong bg-surface-2 px-3 text-text placeholder:text-muted/70 aria-[invalid=true]:border-danger";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  suffix?: string;
};

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, hint, error, suffix, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={cx(inputClass, suffix && "pr-12")}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          {...rest}
        />
        {suffix && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      <FieldError id={errorId} error={error} />
    </div>
  );
});

export function FieldError({ id, error }: { id?: string; error?: string | null }) {
  if (!error) return null;
  return (
    <p id={id} className="flex items-center gap-1 text-xs font-medium text-danger">
      <XCircle aria-hidden className="size-3.5 shrink-0" />
      {error}
    </p>
  );
}

type SelectProps = ComponentProps<"select"> & { label: string; hint?: ReactNode; error?: string | null };

export function SelectField({ label, hint, error, id, className, children, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={selectId} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={selectId}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...rest}
      >
        {children}
      </select>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      <FieldError id={errorId} error={error} />
    </div>
  );
}

/** Segmented radio group (e.g. metric / imperial). Native radios keep keyboard behaviour. */
export function SegmentedRadio<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  hint,
}: {
  legend: string;
  name: string;
  value: T | null;
  options: { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 2)}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border-strong bg-surface-2 px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-semibold">{o.label}</span>
              {o.description && <span className="block text-xs text-muted">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Layout and feedback
// ---------------------------------------------------------------------------

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section className={cx("rounded-2xl border border-border bg-surface p-4 sm:p-5", className)} {...rest} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

type AlertTone = "info" | "success" | "warning" | "error";

const alertStyles: Record<AlertTone, { box: string; Icon: typeof Info }> = {
  info: { box: "border-info/40 bg-info-bg text-info", Icon: Info },
  success: { box: "border-ok/40 bg-ok-bg text-ok", Icon: CheckCircle2 },
  warning: { box: "border-warn/40 bg-warn-bg text-warn", Icon: AlertTriangle },
  error: { box: "border-danger/40 bg-danger-bg text-danger", Icon: XCircle },
};

/** Status message with an icon and text, so meaning never relies on colour alone. */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = alertStyles[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-xl border p-3 text-sm", box, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-text/90">{children}</div>}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted">
      <Loader2 aria-hidden className="size-4 animate-spin" />
      <span>{label}…</span>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-4 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h2 className="text-base font-semibold">{title}</h2>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Loading / error-with-retry wrapper for query results. */
export function QueryState({
  isPending,
  error,
  onRetry,
  loadingLabel,
}: {
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  loadingLabel?: string;
}) {
  if (isPending) return <Spinner label={loadingLabel} />;
  if (error) {
    return (
      <Alert
        tone="error"
        title="Couldn't load this"
        action={
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        }
      >
        {error instanceof Error ? error.message : "Check your connection and try again."}
      </Alert>
    );
  }
  return null;
}
