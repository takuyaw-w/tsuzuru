import type { ComponentChildren, ComponentProps } from "preact";
import { joinClassNames } from "./class-name.js";
import { createTsuzuruThemeCssVariables, type TsuzuruTheme } from "./theme.js";

type DivStyle = NonNullable<ComponentProps<"div">["style"]>;

export interface TsuzuruThemeProviderProps {
  readonly theme: TsuzuruTheme;
  readonly children?: ComponentChildren;
  readonly className?: string;
}

export function TsuzuruThemeProvider({ theme, children, className }: TsuzuruThemeProviderProps): ComponentChildren {
  return (
    <div
      className={joinClassNames("tzr-theme-root", theme.className, className)}
      data-tzr-theme={theme.id}
      style={createTsuzuruThemeCssVariables(theme) as DivStyle}
    >
      {children}
    </div>
  );
}
