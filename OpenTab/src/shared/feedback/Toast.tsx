type ToastProps = {
  message: string;
  className?: string;
};

export function Toast({ message, className = "" }: ToastProps) {
  return (
    <div className={`menu-toast ${className}`.trim()}>
      <span className="menu-toast-dot" />
      <span>{message}</span>
    </div>
  );
}
