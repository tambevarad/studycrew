import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-md border px-4 py-3 text-sm", {
  variants: {
    tone: {
      info: "border-brand-200 bg-brand-50 text-brand-800",
      success: "border-success-100 bg-success-50 text-success-700",
      warning: "border-warning-100 bg-warning-50 text-warning-700",
      danger: "border-danger-100 bg-danger-50 text-danger-700",
    },
  },
  defaultVariants: { tone: "info" },
});

export function Alert({ className, tone, ...props }: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role={tone === "danger" ? "alert" : "status"} className={cn(alertVariants({ tone }), className)} {...props} />;
}
