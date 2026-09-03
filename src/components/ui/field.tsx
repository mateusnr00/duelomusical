import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full rounded-sm border border-line bg-surface px-4 py-3 text-sm text-text placeholder:text-muted-dim transition-colors focus:border-accent focus:outline-none";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="eyebrow block">{label}</span>
      <span className="mt-2 block">{children}</span>
      {hint && <span className="mt-2 block text-xs text-muted-dim">{hint}</span>}
    </label>
  );
}

export function Input({ className = "", ...rest }: ComponentProps<"input">) {
  return <input className={`${control} ${className}`} {...rest} />;
}

export function Textarea({ className = "", ...rest }: ComponentProps<"textarea">) {
  return <textarea className={`${control} ${className}`} {...rest} />;
}

export function Select({ className = "", ...rest }: ComponentProps<"select">) {
  return <select className={`${control} ${className}`} {...rest} />;
}

/** Mensagem de erro de formulário, anunciada por leitor de tela. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="border-l-2 border-danger bg-danger/5 px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}
