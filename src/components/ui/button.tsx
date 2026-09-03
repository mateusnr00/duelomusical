import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "outline" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-void hover:bg-text disabled:hover:bg-accent border border-transparent",
  outline:
    "border border-line-strong text-text hover:border-accent hover:text-accent",
  ghost: "border border-transparent text-muted hover:text-text",
  danger: "border border-transparent text-muted hover:text-danger",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm px-5 py-3 text-[0.7rem] font-medium uppercase tracking-[0.16em] transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-45";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  ...rest
}: { href: string; variant?: Variant; className?: string; children: ReactNode } & Omit<
  ComponentProps<typeof Link>,
  "href" | "className" | "children"
>) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}
