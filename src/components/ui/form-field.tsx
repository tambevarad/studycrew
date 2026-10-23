import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { Label } from "./input";

/**
 * Label + control + hint + error, wired for screen readers (NFR-03).
 *   <FormField label="Title" error={fieldErrors.title}><Input name="title" /></FormField>
 */
export function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactElement<Record<string, unknown>>;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })
    : children;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-danger-600"> *</span> : null}
      </Label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
