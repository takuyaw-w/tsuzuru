import type { ComponentChildren, ComponentProps } from "preact";
import { joinClassNames } from "./class-name.js";

export interface ScreenProps extends Omit<ComponentProps<"div">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
  readonly variant?: "default" | "overlay" | undefined;
}

export function Screen({ children, className, variant = "default", ...props }: ScreenProps): ComponentChildren {
  return (
    <div {...props} className={joinClassNames("tzr-screen", `tzr-screen--${variant}`, className)}>
      {children}
    </div>
  );
}

export interface ScreenPanelProps extends Omit<ComponentProps<"div">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
}

export function ScreenPanel({ children, className, ...props }: ScreenPanelProps): ComponentChildren {
  return (
    <div {...props} className={joinClassNames("tzr-screen__panel", className)}>
      {children}
    </div>
  );
}

export interface ScreenHeadingProps extends Omit<ComponentProps<"div">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly eyebrow?: ComponentChildren | undefined;
  readonly className?: string | undefined;
}

export function ScreenHeading({ children, eyebrow, className, ...props }: ScreenHeadingProps): ComponentChildren {
  return (
    <div {...props} className={joinClassNames("tzr-screen__heading-block", className)}>
      {eyebrow === undefined ? null : <p className="tzr-screen__eyebrow">{eyebrow}</p>}
      <h1 className="tzr-screen__heading">{children}</h1>
    </div>
  );
}

export interface ScreenTextProps extends Omit<ComponentProps<"p">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
}

export function ScreenText({ children, className, ...props }: ScreenTextProps): ComponentChildren {
  return (
    <p {...props} className={joinClassNames("tzr-screen__text", className)}>
      {children}
    </p>
  );
}

export interface ScreenActionsProps extends Omit<ComponentProps<"div">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
  readonly columns?: 1 | 2 | undefined;
}

export function ScreenActions({ children, className, columns = 1, ...props }: ScreenActionsProps): ComponentChildren {
  return (
    <div
      {...props}
      className={joinClassNames("tzr-screen__actions", `tzr-screen__actions--columns-${columns}`, className)}
    >
      {children}
    </div>
  );
}

export interface ScreenButtonProps
  extends Omit<ComponentProps<"button">, "children" | "className" | "disabled" | "onClick" | "type"> {
  readonly children: ComponentChildren;
  readonly onClick?: (() => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
  readonly variant?: "default" | "primary" | "danger" | undefined;
}

export function ScreenButton({
  children,
  onClick,
  disabled,
  className,
  variant = "default",
  ...props
}: ScreenButtonProps): ComponentChildren {
  return (
    <button
      {...props}
      className={joinClassNames("tzr-screen__button", `tzr-screen__button--${variant}`, className)}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export interface ScreenFieldProps extends Omit<ComponentProps<"label">, "children" | "className"> {
  readonly label: ComponentChildren;
  readonly children: ComponentChildren;
  readonly hint?: ComponentChildren | undefined;
  readonly className?: string | undefined;
}

export function ScreenField({ label, children, hint, className, ...props }: ScreenFieldProps): ComponentChildren {
  return (
    <label {...props} className={joinClassNames("tzr-screen__field", className)}>
      <span className="tzr-screen__field-label">{label}</span>
      <span className="tzr-screen__field-control">{children}</span>
      {hint === undefined ? null : <span className="tzr-screen__field-hint">{hint}</span>}
    </label>
  );
}

export interface ScreenListProps extends Omit<ComponentProps<"div">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
}

export function ScreenList({ children, className, ...props }: ScreenListProps): ComponentChildren {
  return (
    <div {...props} className={joinClassNames("tzr-screen__list", className)}>
      {children}
    </div>
  );
}

export interface ScreenListItemProps extends Omit<ComponentProps<"div">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
}

export function ScreenListItem({ children, className, ...props }: ScreenListItemProps): ComponentChildren {
  return (
    <div {...props} className={joinClassNames("tzr-screen__list-item", className)}>
      {children}
    </div>
  );
}

export interface ScreenBadgeProps extends Omit<ComponentProps<"span">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
}

export function ScreenBadge({ children, className, ...props }: ScreenBadgeProps): ComponentChildren {
  return (
    <span {...props} className={joinClassNames("tzr-screen__badge", className)}>
      {children}
    </span>
  );
}
