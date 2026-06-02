import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline";
  size?: "sm" | "md" | "lg";
}

const variantClassNames: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-[var(--foreground)] text-white",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
};

const sizeClassNames: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        variantClassNames[variant],
        sizeClassNames[size],
        className
      )}
      {...props}
    />
  );
}
