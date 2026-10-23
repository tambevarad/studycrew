import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "StudyCrew", template: "%s · StudyCrew" },
  description: "Plan group work, find meeting times, and catch missing requirements before you submit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        {/* Our status tokens instead of sonner's richColors: its success text is 4.26:1 and fails WCAG AA (NFR-03). */}
        <Toaster
          position="top-right"
          closeButton
          toastOptions={{
            classNames: {
              success: "border-success-100! bg-success-50! text-success-700!",
              error: "border-danger-100! bg-danger-50! text-danger-700!",
              warning: "border-warning-100! bg-warning-50! text-warning-700!",
            },
          }}
        />
      </body>
    </html>
  );
}
