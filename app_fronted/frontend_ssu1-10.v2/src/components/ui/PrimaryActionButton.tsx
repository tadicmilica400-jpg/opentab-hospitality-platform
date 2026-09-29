import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PrimaryActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  price?: string;
  icon?: ReactNode;
}

export default function PrimaryActionButton({ label, price, icon, className = '', ...props }: PrimaryActionButtonProps) {
  return (
    <button className={`primary-action-button ${className}`} type="button" {...props}>
      <span className="btn-label">{icon}{label}</span>
      {price && <span className="btn-price">{price}</span>}
    </button>
  );
}
