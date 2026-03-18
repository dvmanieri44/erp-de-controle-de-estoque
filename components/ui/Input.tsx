import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  label: string;
};

export function Input({
  className = "",
  error,
  id,
  label,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        className={[
          "h-11 rounded-xl border px-3 text-sm outline-none transition-colors",
          error
            ? "border-rose-400 focus:border-rose-500"
            : "border-slate-300 focus:border-slate-500",
          className,
        ].join(" ")}
        id={id}
        {...props}
      />
      {error ? <span className="text-sm text-rose-500">{error}</span> : null}
    </div>
  );
}
