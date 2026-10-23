"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Friendly error with a retry instead of a blank page (UI guidelines §6). */
export default function NotificationsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Alert tone="danger" className="flex flex-wrap items-center justify-between gap-3">
      <span>We couldn&apos;t load your notifications. Check your connection, then try again.</span>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </Alert>
  );
}
