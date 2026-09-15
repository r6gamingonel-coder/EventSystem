import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-maroon-700 text-brand-cream-50 hover:bg-brand-maroon-800 shadow-sm shadow-brand-maroon-900/20",
  secondary:
    "bg-brand-gold-500 text-brand-maroon-900 hover:bg-brand-gold-600",
  outline:
    "border border-brand-line bg-transparent text-brand-ink hover:bg-brand-cream-100",
  ghost: "bg-transparent text-brand-ink hover:bg-brand-cream-100",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none min-h-11 min-w-11";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  onClick,
}: CommonProps & {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
    >
      {children}
    </Link>
  );
}
