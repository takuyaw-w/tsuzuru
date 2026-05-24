import type { ComponentChildren, ComponentProps } from "preact";
import { joinClassNames } from "./class-name.js";

type ButtonProps = ComponentProps<"button">;
type OrderedListProps = Omit<ComponentProps<"ol">, "children" | "className">;
type UnorderedListProps = Omit<ComponentProps<"ul">, "children" | "className">;

export interface ScreenProps extends Omit<ComponentProps<"section">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
  readonly variant?: "default" | "overlay" | undefined;
}

export function Screen({ children, className, variant = "default", ...props }: ScreenProps): ComponentChildren {
  return (
    <section {...props} className={joinClassNames("tzr-screen", `tzr-screen--${variant}`, className)}>
      {children}
    </section>
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

export interface ScreenButtonProps extends Omit<ButtonProps, "children" | "className" | "type"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
  readonly variant?: "default" | "primary" | "danger" | undefined;
}

export function ScreenButton({
  children,
  className,
  variant = "default",
  ...props
}: ScreenButtonProps): ComponentChildren {
  return (
    <button
      {...props}
      className={joinClassNames("tzr-screen__button", `tzr-screen__button--${variant}`, className)}
      type="button"
    >
      {children}
    </button>
  );
}

export interface ScreenFieldProps extends Omit<ComponentProps<"label">, "children" | "className"> {
  readonly label: ComponentChildren;
  readonly children: ComponentChildren;
  readonly hint?: ComponentChildren | undefined;
  readonly hintId?: string | undefined;
  readonly className?: string | undefined;
}

export function ScreenField({
  label,
  children,
  hint,
  hintId,
  className,
  ...props
}: ScreenFieldProps): ComponentChildren {
  return (
    <label {...props} className={joinClassNames("tzr-screen__field", className)}>
      <span className="tzr-screen__field-label">{label}</span>
      <span className="tzr-screen__field-control">{children}</span>
      {hint === undefined ? null : (
        <span id={hintId} className="tzr-screen__field-hint">
          {hint}
        </span>
      )}
    </label>
  );
}

export type ScreenListProps =
  | ({
      readonly children: ComponentChildren;
      readonly className?: string | undefined;
      readonly ordered?: false | undefined;
    } & UnorderedListProps)
  | ({
      readonly children: ComponentChildren;
      readonly className?: string | undefined;
      readonly ordered: true;
    } & OrderedListProps);

export function ScreenList(props: ScreenListProps): ComponentChildren {
  if (props.ordered === true) {
    const { children, className, ordered: _ordered, role, ...listProps } = props;
    return (
      <ol {...listProps} role={role ?? "list"} className={joinClassNames("tzr-screen__list", className)}>
        {children}
      </ol>
    );
  }

  const { children, className, ordered: _ordered, role, ...listProps } = props;
  return (
    <ul {...listProps} role={role ?? "list"} className={joinClassNames("tzr-screen__list", className)}>
      {children}
    </ul>
  );
}

export interface ScreenListItemProps extends Omit<ComponentProps<"li">, "children" | "className"> {
  readonly children: ComponentChildren;
  readonly className?: string | undefined;
}

export function ScreenListItem({ children, className, ...props }: ScreenListItemProps): ComponentChildren {
  return (
    <li {...props} className={joinClassNames("tzr-screen__list-item", className)}>
      {children}
    </li>
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
