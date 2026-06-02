import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        suppressHydrationWarning
        className={cn(
          "h-11 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none ring-[var(--ring)] focus:ring-2",
          className
        )}
        {...props}
      />
    );
  }
);
