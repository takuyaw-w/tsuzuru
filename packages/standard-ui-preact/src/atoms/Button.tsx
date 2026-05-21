import type { ComponentChildren } from "preact";

export interface StandardButtonProps {
  readonly className: string;
  readonly children: ComponentChildren;
  readonly onClick?: () => void;
}

export function StandardButton({ className, children, onClick }: StandardButtonProps): ComponentChildren {
  return (
    <button className={className} type="button" onClick={onClick}>
      {children}
    </button>
  );
}
