import type { ComponentChildren, JSX } from "preact";
import { joinClassNames } from "./class-name.js";

export type TitleScreenAction = {
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean | undefined;
};

export type TitleScreenProps = {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly description?: string | undefined;
  readonly actions: readonly TitleScreenAction[];
  readonly footer?: ComponentChildren | undefined;
  readonly children?: ComponentChildren | undefined;
  readonly className?: string | undefined;
  readonly style?: JSX.CSSProperties | undefined;
};

export function TitleScreen({
  title,
  subtitle,
  description,
  actions,
  footer,
  children,
  className,
  style,
}: TitleScreenProps): ComponentChildren {
  return (
    <section className={joinClassNames("tzr-title-screen", className)} style={style}>
      <div className="tzr-title-screen__inner">
        <h1 className="tzr-title-screen__title">{title}</h1>
        {subtitle === undefined ? null : <p className="tzr-title-screen__subtitle">{subtitle}</p>}
        {description === undefined ? null : <p className="tzr-title-screen__description">{description}</p>}
        {children}
        <div className="tzr-title-screen__actions" aria-label="Title menu">
          {actions.map((action, index) => (
            <button
              type="button"
              className="tzr-title-screen__action"
              disabled={action.disabled === true}
              onClick={action.disabled === true ? undefined : action.onSelect}
              key={`${index}:${action.label}`}
            >
              {action.label}
            </button>
          ))}
        </div>
        {footer === undefined ? null : <footer className="tzr-title-screen__footer">{footer}</footer>}
      </div>
    </section>
  );
}
