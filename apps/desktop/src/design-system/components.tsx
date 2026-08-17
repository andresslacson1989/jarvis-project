import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a className="ds-skip-link" href={`#${targetId}`}>
      Skip to main content
    </a>
  );
}

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} className={`ds-button ds-button--${variant} ${className}`.trim()} type={props.type ?? "button"} />;
}

export function Panel({ heading, children, className = "" }: { heading?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`ds-panel ${className}`.trim()}>
      {heading ? <h2 className="ds-panel__heading">{heading}</h2> : null}
      {children}
    </section>
  );
}

export function TextInput({ label, description, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? `jarvis-input-${generatedId}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [descriptionId, errorId, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;

  return (
    <div className="ds-field">
      <label className="ds-field__label" htmlFor={inputId}>{label}</label>
      {description ? <p className="ds-field__description" id={descriptionId}>{description}</p> : null}
      <input {...props} aria-describedby={describedBy} aria-invalid={error ? true : props["aria-invalid"]} className={`ds-input ${props.className ?? ""}`.trim()} id={inputId} />
      {error ? <p className="ds-field__error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}

export function StatusChip({ state, children }: { state: "info" | "success" | "warning" | "error" | "waiting" | "neutral"; children: ReactNode }) {
  return <span className={`ds-status-chip ds-status-chip--${state}`} role="status">{children}</span>;
}
