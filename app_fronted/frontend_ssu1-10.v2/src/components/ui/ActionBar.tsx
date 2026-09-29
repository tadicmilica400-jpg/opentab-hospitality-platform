import type { ReactNode } from 'react';

interface ActionBarProps {
  children: ReactNode;
  className?: string;
}

export default function ActionBar({ children, className = '' }: ActionBarProps) {
  return <div className={`action-bar ${className}`}>{children}</div>;
}
