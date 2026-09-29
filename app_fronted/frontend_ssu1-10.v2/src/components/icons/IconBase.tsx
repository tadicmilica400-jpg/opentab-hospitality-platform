import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement>;

export function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}
