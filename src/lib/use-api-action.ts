"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { ApiClientError } from "./api-client";

/**
 * Standard mutation pattern for Client Components:
 *   const { run, pending, fieldErrors } = useApiAction();
 *   await run(() => apiFetch(...), { success: "Task created" });
 * On success: optional toast + router.refresh() so Server Components re-read.
 * On error: toast with the server's user-friendly message; field errors exposed for forms.
 */
export function useApiAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { success?: string; refresh?: boolean } = {}): Promise<T | undefined> => {
      setPending(true);
      setFieldErrors({});
      try {
        const result = await fn();
        if (opts.success) toast.success(opts.success);
        if (opts.refresh !== false) startTransition(() => router.refresh());
        return result;
      } catch (err) {
        if (err instanceof ApiClientError) {
          setFieldErrors(err.fieldErrors);
          toast.error(err.message);
        } else {
          toast.error("Something went wrong. Please try again.");
        }
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { run, pending, fieldErrors };
}
