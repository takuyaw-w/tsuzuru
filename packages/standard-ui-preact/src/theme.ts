export interface TsuzuruTheme {
  readonly id: string;
  readonly name: string;
  readonly className?: string;
  readonly tokens?: TsuzuruThemeTokens;
  readonly cssVariables?: TsuzuruThemeCssVariables;
}

export type TsuzuruThemeCssVariables = Partial<Record<TsuzuruThemeCssVariableName, string>>;

export type TsuzuruThemeCssVariableName =
  | "--tzr-color-surface"
  | "--tzr-color-surface-border"
  | "--tzr-color-text"
  | "--tzr-color-muted-text"
  | "--tzr-color-accent"
  | "--tzr-font-family"
  | "--tzr-message-text-font-size"
  | "--tzr-message-text-line-height"
  | "--tzr-message-window-bg"
  | "--tzr-message-window-border"
  | "--tzr-message-window-radius"
  | "--tzr-message-window-padding"
  | "--tzr-message-window-shadow"
  | "--tzr-message-window-backdrop-filter"
  | "--tzr-message-window-text-color"
  | "--tzr-message-window-muted-text-color"
  | "--tzr-message-speaker-bg"
  | "--tzr-message-speaker-border"
  | "--tzr-message-speaker-color"
  | "--tzr-message-speaker-marker-color"
  | "--tzr-message-speaker-radius"
  | "--tzr-message-speaker-padding"
  | "--tzr-message-speaker-shadow"
  | "--tzr-choice-layer-bg"
  | "--tzr-choice-layer-border"
  | "--tzr-choice-border-radius"
  | "--tzr-choice-layer-padding"
  | "--tzr-choice-layer-shadow"
  | "--tzr-choice-question-color"
  | "--tzr-choice-gap"
  | "--tzr-choice-button-bg"
  | "--tzr-choice-button-hover-bg"
  | "--tzr-choice-button-border"
  | "--tzr-choice-button-padding"
  | "--tzr-choice-button-shadow"
  | "--tzr-choice-button-hover-shadow"
  | "--tzr-choice-button-text-color";

export interface TsuzuruThemeTokens {
  readonly colors?: TsuzuruThemeColorTokens;
  readonly typography?: TsuzuruThemeTypographyTokens;
  readonly radius?: TsuzuruThemeRadiusTokens;
  readonly shadow?: TsuzuruThemeShadowTokens;
  readonly messageWindow?: TsuzuruMessageWindowThemeTokens;
  readonly choiceLayer?: TsuzuruChoiceLayerThemeTokens;
}

export interface TsuzuruThemeColorTokens {
  readonly surface?: string;
  readonly surfaceBorder?: string;
  readonly text?: string;
  readonly mutedText?: string;
  readonly accent?: string;
}

export interface TsuzuruThemeTypographyTokens {
  readonly fontFamily?: string;
  readonly messageFontSize?: string;
  readonly messageLineHeight?: string;
}

export interface TsuzuruThemeRadiusTokens {
  readonly window?: string;
  readonly choice?: string;
}

export interface TsuzuruThemeShadowTokens {
  readonly window?: string;
  readonly choice?: string;
  readonly text?: string;
}

export interface TsuzuruMessageWindowThemeTokens {
  readonly background?: string;
  readonly borderColor?: string;
  readonly borderRadius?: string;
  readonly padding?: string;
  readonly shadow?: string;
  readonly backdropFilter?: string;
  readonly textColor?: string;
  readonly mutedTextColor?: string;
  readonly speakerBackground?: string;
  readonly speakerBorderColor?: string;
  readonly speakerTextColor?: string;
  readonly speakerMarkerColor?: string;
  readonly speakerRadius?: string;
  readonly speakerPadding?: string;
  readonly speakerShadow?: string;
}

export interface TsuzuruChoiceLayerThemeTokens {
  readonly background?: string;
  readonly borderColor?: string;
  readonly borderRadius?: string;
  readonly padding?: string;
  readonly shadow?: string;
  readonly questionTextColor?: string;
  readonly gap?: string;
  readonly buttonBackground?: string;
  readonly buttonHoverBackground?: string;
  readonly buttonBorderColor?: string;
  readonly buttonPadding?: string;
  readonly buttonShadow?: string;
  readonly buttonHoverShadow?: string;
  readonly buttonTextColor?: string;
}

export const standardThemeClassName = "tzr-theme-standard";
export const classicThemeClassName = "tzr-theme-classic";
export const darkNovelThemeClassName = "tzr-theme-dark-novel";
export const minimalThemeClassName = "tzr-theme-minimal";

export const standardTheme = {
  id: "standard",
  name: "Standard",
  className: standardThemeClassName,
  tokens: {
    colors: {
      surface: "linear-gradient(180deg, rgba(24, 24, 26, 0.88), rgba(8, 9, 12, 0.9)), rgba(0, 0, 0, 0.78)",
      surfaceBorder: "rgba(247, 242, 226, 0.46)",
      text: "#fffaf0",
      mutedText: "rgba(255, 250, 240, 0.68)",
      accent: "rgba(255, 220, 143, 0.92)",
    },
    typography: {
      fontFamily: "system-ui, sans-serif",
      messageFontSize: "clamp(1rem, 2vw, 1.28rem)",
      messageLineHeight: "1.68",
    },
    radius: {
      window: "10px",
      choice: "10px",
    },
    shadow: {
      window: "inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 18px 42px rgba(0, 0, 0, 0.44)",
      choice: "0 18px 44px rgba(0, 0, 0, 0.46)",
      text: "0 1px 2px rgba(0, 0, 0, 0.62)",
    },
    messageWindow: {
      background: "linear-gradient(180deg, rgba(24, 24, 26, 0.88), rgba(8, 9, 12, 0.9)), rgba(0, 0, 0, 0.78)",
      borderColor: "rgba(247, 242, 226, 0.46)",
      borderRadius: "10px",
      padding: "clamp(42px, 3.8vw, 50px) clamp(22px, 3.4vw, 36px) clamp(20px, 2.8vw, 28px)",
      shadow: "inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 18px 42px rgba(0, 0, 0, 0.44)",
      backdropFilter: "blur(10px) saturate(1.08)",
      textColor: "#fffaf0",
      mutedTextColor: "rgba(255, 250, 240, 0.68)",
      speakerBackground: "linear-gradient(180deg, rgba(36, 35, 34, 0.82), rgba(14, 15, 17, 0.78))",
      speakerBorderColor: "rgba(247, 242, 226, 0.3)",
      speakerTextColor: "rgba(255, 226, 162, 0.96)",
      speakerMarkerColor: "rgba(255, 226, 162, 0.82)",
      speakerRadius: "999px",
      speakerPadding: "5px 16px",
      speakerShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 6px 16px rgba(0, 0, 0, 0.16)",
    },
    choiceLayer: {
      background: "linear-gradient(180deg, rgba(25, 30, 35, 0.92), rgba(8, 10, 13, 0.92)), rgba(0, 0, 0, 0.82)",
      borderColor: "rgba(247, 242, 226, 0.44)",
      borderRadius: "10px",
      padding: "clamp(16px, 2.4vw, 24px)",
      shadow: "0 18px 44px rgba(0, 0, 0, 0.46)",
      questionTextColor: "#fff1c7",
      gap: "9px",
      buttonBackground: "rgba(255, 255, 255, 0.08)",
      buttonHoverBackground: "rgba(120, 76, 48, 0.62)",
      buttonBorderColor: "rgba(247, 242, 226, 0.36)",
      buttonPadding: "10px 16px",
      buttonShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
      buttonHoverShadow: "0 10px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.14)",
      buttonTextColor: "#fffaf0",
    },
  },
} satisfies TsuzuruTheme;

export const classicTheme = {
  id: "classic",
  name: "Classic",
  className: classicThemeClassName,
} satisfies TsuzuruTheme;

export const darkNovelTheme = {
  id: "dark-novel",
  name: "Dark Novel",
  className: darkNovelThemeClassName,
} satisfies TsuzuruTheme;

export const minimalTheme = {
  id: "minimal",
  name: "Minimal",
  className: minimalThemeClassName,
} satisfies TsuzuruTheme;

export type TsuzuruResolvedTheme = TsuzuruTheme & {
  readonly tokens: ResolvedTsuzuruThemeTokens;
};

type ResolvedTsuzuruThemeTokens = {
  readonly colors: Required<TsuzuruThemeColorTokens>;
  readonly typography: Required<TsuzuruThemeTypographyTokens>;
  readonly radius: Required<TsuzuruThemeRadiusTokens>;
  readonly shadow: Required<TsuzuruThemeShadowTokens>;
  readonly messageWindow: Required<TsuzuruMessageWindowThemeTokens>;
  readonly choiceLayer: Required<TsuzuruChoiceLayerThemeTokens>;
};

export function resolveTsuzuruTheme(theme: TsuzuruTheme): TsuzuruResolvedTheme {
  const defaults = standardTheme.tokens;
  const colors = { ...defaults.colors, ...theme.tokens?.colors };
  const typography = { ...defaults.typography, ...theme.tokens?.typography };
  const radius = { ...defaults.radius, ...theme.tokens?.radius };
  const shadow = { ...defaults.shadow, ...theme.tokens?.shadow };
  const messageWindow = { ...defaults.messageWindow, ...theme.tokens?.messageWindow };
  const choiceLayer = { ...defaults.choiceLayer, ...theme.tokens?.choiceLayer };

  return {
    ...theme,
    tokens: {
      colors,
      typography,
      radius,
      shadow,
      messageWindow: {
        background: messageWindow.background ?? colors.surface,
        borderColor: messageWindow.borderColor ?? colors.surfaceBorder,
        borderRadius: messageWindow.borderRadius ?? radius.window,
        padding: messageWindow.padding,
        shadow: messageWindow.shadow ?? shadow.window,
        backdropFilter: messageWindow.backdropFilter,
        textColor: messageWindow.textColor ?? colors.text,
        mutedTextColor: messageWindow.mutedTextColor ?? colors.mutedText,
        speakerBackground: messageWindow.speakerBackground,
        speakerBorderColor: messageWindow.speakerBorderColor ?? colors.surfaceBorder,
        speakerTextColor: messageWindow.speakerTextColor ?? colors.accent,
        speakerMarkerColor: messageWindow.speakerMarkerColor ?? colors.accent,
        speakerRadius: messageWindow.speakerRadius ?? radius.window,
        speakerPadding: messageWindow.speakerPadding,
        speakerShadow: messageWindow.speakerShadow,
      },
      choiceLayer: {
        background: choiceLayer.background ?? colors.surface,
        borderColor: choiceLayer.borderColor ?? colors.surfaceBorder,
        borderRadius: choiceLayer.borderRadius ?? radius.choice,
        padding: choiceLayer.padding,
        shadow: choiceLayer.shadow ?? shadow.choice,
        questionTextColor: choiceLayer.questionTextColor ?? colors.accent,
        gap: choiceLayer.gap,
        buttonBackground: choiceLayer.buttonBackground,
        buttonHoverBackground: choiceLayer.buttonHoverBackground,
        buttonBorderColor: choiceLayer.buttonBorderColor ?? colors.surfaceBorder,
        buttonPadding: choiceLayer.buttonPadding,
        buttonShadow: choiceLayer.buttonShadow,
        buttonHoverShadow: choiceLayer.buttonHoverShadow,
        buttonTextColor: choiceLayer.buttonTextColor ?? colors.text,
      },
    },
  };
}

export function createTsuzuruThemeCssVariables(theme: TsuzuruTheme): Record<string, string> {
  return {
    ...createTokenCssVariables(theme.tokens),
    ...theme.cssVariables,
  };
}

function createTokenCssVariables(tokens: TsuzuruThemeTokens | undefined): Record<string, string> {
  const variables: Record<string, string> = {};
  setVariable(variables, "--tzr-color-surface", tokens?.colors?.surface);
  setVariable(variables, "--tzr-color-surface-border", tokens?.colors?.surfaceBorder);
  setVariable(variables, "--tzr-color-text", tokens?.colors?.text);
  setVariable(variables, "--tzr-color-muted-text", tokens?.colors?.mutedText);
  setVariable(variables, "--tzr-color-accent", tokens?.colors?.accent);
  setVariable(variables, "--tzr-font-family", tokens?.typography?.fontFamily);
  setVariable(variables, "--tzr-message-text-font-size", tokens?.typography?.messageFontSize);
  setVariable(variables, "--tzr-message-text-line-height", tokens?.typography?.messageLineHeight);
  setVariable(variables, "--tzr-message-window-bg", tokens?.messageWindow?.background);
  setVariable(variables, "--tzr-message-window-border", tokens?.messageWindow?.borderColor);
  setVariable(variables, "--tzr-message-window-radius", tokens?.messageWindow?.borderRadius ?? tokens?.radius?.window);
  setVariable(variables, "--tzr-message-window-padding", tokens?.messageWindow?.padding);
  setVariable(variables, "--tzr-message-window-shadow", tokens?.messageWindow?.shadow ?? tokens?.shadow?.window);
  setVariable(variables, "--tzr-message-window-backdrop-filter", tokens?.messageWindow?.backdropFilter);
  setVariable(variables, "--tzr-message-window-text-color", tokens?.messageWindow?.textColor);
  setVariable(variables, "--tzr-message-window-muted-text-color", tokens?.messageWindow?.mutedTextColor);
  setVariable(variables, "--tzr-message-speaker-bg", tokens?.messageWindow?.speakerBackground);
  setVariable(variables, "--tzr-message-speaker-border", tokens?.messageWindow?.speakerBorderColor);
  setVariable(variables, "--tzr-message-speaker-color", tokens?.messageWindow?.speakerTextColor);
  setVariable(variables, "--tzr-message-speaker-marker-color", tokens?.messageWindow?.speakerMarkerColor);
  setVariable(variables, "--tzr-message-speaker-radius", tokens?.messageWindow?.speakerRadius);
  setVariable(variables, "--tzr-message-speaker-padding", tokens?.messageWindow?.speakerPadding);
  setVariable(variables, "--tzr-message-speaker-shadow", tokens?.messageWindow?.speakerShadow);
  setVariable(variables, "--tzr-choice-layer-bg", tokens?.choiceLayer?.background);
  setVariable(variables, "--tzr-choice-layer-border", tokens?.choiceLayer?.borderColor);
  setVariable(variables, "--tzr-choice-border-radius", tokens?.choiceLayer?.borderRadius ?? tokens?.radius?.choice);
  setVariable(variables, "--tzr-choice-layer-padding", tokens?.choiceLayer?.padding);
  setVariable(variables, "--tzr-choice-layer-shadow", tokens?.choiceLayer?.shadow ?? tokens?.shadow?.choice);
  setVariable(variables, "--tzr-choice-question-color", tokens?.choiceLayer?.questionTextColor);
  setVariable(variables, "--tzr-choice-gap", tokens?.choiceLayer?.gap);
  setVariable(variables, "--tzr-choice-button-bg", tokens?.choiceLayer?.buttonBackground);
  setVariable(variables, "--tzr-choice-button-hover-bg", tokens?.choiceLayer?.buttonHoverBackground);
  setVariable(variables, "--tzr-choice-button-border", tokens?.choiceLayer?.buttonBorderColor);
  setVariable(variables, "--tzr-choice-button-padding", tokens?.choiceLayer?.buttonPadding);
  setVariable(variables, "--tzr-choice-button-shadow", tokens?.choiceLayer?.buttonShadow);
  setVariable(variables, "--tzr-choice-button-hover-shadow", tokens?.choiceLayer?.buttonHoverShadow);
  setVariable(variables, "--tzr-choice-button-text-color", tokens?.choiceLayer?.buttonTextColor);
  return variables;
}

function setVariable(variables: Record<string, string>, name: TsuzuruThemeCssVariableName, value: string | undefined) {
  if (value !== undefined) {
    variables[name] = value;
  }
}
