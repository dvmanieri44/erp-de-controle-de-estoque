import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  isFullWidth?: boolean;
};

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 disabled:text-slate-400",
};

export function Button({
  children,
  className = "",
  isFullWidth = false,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        variantClassName[variant],
        isFullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
