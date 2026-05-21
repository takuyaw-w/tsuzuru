import type { ComponentChildren, ComponentProps } from "preact";

type DivProps = ComponentProps<"div">;

export interface PanelProps {
  readonly className: string;
  readonly children?: ComponentChildren;
  readonly onClick?: DivProps["onClick"];
  readonly onKeyDown?: DivProps["onKeyDown"];
  readonly role?: DivProps["role"];
  readonly tabIndex?: DivProps["tabIndex"];
}

export function Panel({ className, children, onClick, onKeyDown, role, tabIndex }: PanelProps): ComponentChildren {
  return (
    <div
      className={className}
      {...(onClick === undefined ? {} : { onClick })}
      {...(onKeyDown === undefined ? {} : { onKeyDown })}
      {...(role === undefined ? {} : { role })}
      {...(tabIndex === undefined ? {} : { tabIndex })}
    >
      {children}
    </div>
  );
}
