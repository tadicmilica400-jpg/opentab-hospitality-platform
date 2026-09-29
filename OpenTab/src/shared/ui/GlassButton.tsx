import type { ButtonHTMLAttributes, ReactNode } from "react";

type GlassButtonVariant = "default" | "primary" | "danger" | "success" | "warning" | "muted";
type GlassButtonSize = "default" | "compact";
type GlassButtonAlign = "center" | "start";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  fullWidth?: boolean;
  align?: GlassButtonAlign;
};

export function GlassButton({
  children,
  variant = "default",
  size = "default",
  fullWidth = false,
  align = "center",
  className = "",
  type = "button",
  ...props
}: GlassButtonProps) {
  const classes = [
    "btn-glass",
    variant !== "default" ? variant : "",
    size !== "default" ? size : "",
    fullWidth ? "full-w" : "",
    align !== "center" ? `align-${align}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
