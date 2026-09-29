import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "default" | "danger" | "success";
};

export function IconButton({ children, variant = "default", className = "", type = "button", ...props }: IconButtonProps) {
  const variantClass = variant === "default" ? "" : variant;

  return (
    <button type={type} className={`action-btn ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
