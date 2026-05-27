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
  | "--tzr-message-window-text-color"
  | "--tzr-message-window-muted-text-color"
  | "--tzr-message-speaker-bg"
  | "--tzr-message-speaker-border"
  | "--tzr-message-speaker-color"
  | "--tzr-message-speaker-marker-color"
  | "--tzr-choice-layer-bg"
  | "--tzr-choice-layer-border"
  | "--tzr-choice-border-radius"
  | "--tzr-choice-layer-shadow"
  | "--tzr-choice-question-color"
  | "--tzr-choice-button-bg"
  | "--tzr-choice-button-hover-bg"
  | "--tzr-choice-button-border"
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
  readonly textColor?: string;
  readonly mutedTextColor?: string;
  readonly speakerBackground?: string;
  readonly speakerBorderColor?: string;
  readonly speakerTextColor?: string;
  readonly speakerMarkerColor?: string;
}

export interface TsuzuruChoiceLayerThemeTokens {
  readonly background?: string;
  readonly borderColor?: string;
  readonly borderRadius?: string;
  readonly shadow?: string;
  readonly questionTextColor?: string;
  readonly buttonBackground?: string;
  readonly buttonHoverBackground?: string;
  readonly buttonBorderColor?: string;
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
      messageLineHeight: "1.75",
    },
    radius: {
      window: "8px",
      choice: "8px",
    },
    shadow: {
      window: "inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 20px 48px rgba(0, 0, 0, 0.45)",
      choice: "0 22px 52px rgba(0, 0, 0, 0.5)",
      text: "0 1px 2px rgba(0, 0, 0, 0.62)",
    },
    messageWindow: {
      background: "linear-gradient(180deg, rgba(24, 24, 26, 0.88), rgba(8, 9, 12, 0.9)), rgba(0, 0, 0, 0.78)",
      borderColor: "rgba(247, 242, 226, 0.46)",
      borderRadius: "8px",
      padding: "clamp(46px, 4.2vw, 54px) clamp(18px, 3.3vw, 34px) clamp(16px, 2.8vw, 28px)",
      shadow: "inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 20px 48px rgba(0, 0, 0, 0.45)",
      textColor: "#fffaf0",
      mutedTextColor: "rgba(255, 250, 240, 0.68)",
      speakerBackground: "linear-gradient(180deg, rgba(24, 24, 26, 0.9), rgba(8, 9, 12, 0.88)), rgba(0, 0, 0, 0.72)",
      speakerBorderColor: "rgba(247, 242, 226, 0.32)",
      speakerTextColor: "rgba(255, 226, 162, 0.96)",
      speakerMarkerColor: "rgba(255, 226, 162, 0.82)",
    },
    choiceLayer: {
      background: "linear-gradient(180deg, rgba(25, 30, 35, 0.92), rgba(8, 10, 13, 0.92)), rgba(0, 0, 0, 0.82)",
      borderColor: "rgba(247, 242, 226, 0.44)",
      borderRadius: "8px",
      shadow: "0 22px 52px rgba(0, 0, 0, 0.5)",
      questionTextColor: "#fff1c7",
      buttonBackground: "rgba(255, 255, 255, 0.08)",
      buttonHoverBackground: "rgba(120, 76, 48, 0.62)",
      buttonBorderColor: "rgba(247, 242, 226, 0.36)",
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
        textColor: messageWindow.textColor ?? colors.text,
        mutedTextColor: messageWindow.mutedTextColor ?? colors.mutedText,
        speakerBackground: messageWindow.speakerBackground,
        speakerBorderColor: messageWindow.speakerBorderColor ?? colors.surfaceBorder,
        speakerTextColor: messageWindow.speakerTextColor ?? colors.accent,
        speakerMarkerColor: messageWindow.speakerMarkerColor ?? colors.accent,
      },
      choiceLayer: {
        background: choiceLayer.background ?? colors.surface,
        borderColor: choiceLayer.borderColor ?? colors.surfaceBorder,
        borderRadius: choiceLayer.borderRadius ?? radius.choice,
        shadow: choiceLayer.shadow ?? shadow.choice,
        questionTextColor: choiceLayer.questionTextColor ?? colors.accent,
        buttonBackground: choiceLayer.buttonBackground,
        buttonHoverBackground: choiceLayer.buttonHoverBackground,
        buttonBorderColor: choiceLayer.buttonBorderColor ?? colors.surfaceBorder,
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
  setVariable(variables, "--tzr-message-window-text-color", tokens?.messageWindow?.textColor);
  setVariable(variables, "--tzr-message-window-muted-text-color", tokens?.messageWindow?.mutedTextColor);
  setVariable(variables, "--tzr-message-speaker-bg", tokens?.messageWindow?.speakerBackground);
  setVariable(variables, "--tzr-message-speaker-border", tokens?.messageWindow?.speakerBorderColor);
  setVariable(variables, "--tzr-message-speaker-color", tokens?.messageWindow?.speakerTextColor);
  setVariable(variables, "--tzr-message-speaker-marker-color", tokens?.messageWindow?.speakerMarkerColor);
  setVariable(variables, "--tzr-choice-layer-bg", tokens?.choiceLayer?.background);
  setVariable(variables, "--tzr-choice-layer-border", tokens?.choiceLayer?.borderColor);
  setVariable(variables, "--tzr-choice-border-radius", tokens?.choiceLayer?.borderRadius ?? tokens?.radius?.choice);
  setVariable(variables, "--tzr-choice-layer-shadow", tokens?.choiceLayer?.shadow ?? tokens?.shadow?.choice);
  setVariable(variables, "--tzr-choice-question-color", tokens?.choiceLayer?.questionTextColor);
  setVariable(variables, "--tzr-choice-button-bg", tokens?.choiceLayer?.buttonBackground);
  setVariable(variables, "--tzr-choice-button-hover-bg", tokens?.choiceLayer?.buttonHoverBackground);
  setVariable(variables, "--tzr-choice-button-border", tokens?.choiceLayer?.buttonBorderColor);
  setVariable(variables, "--tzr-choice-button-text-color", tokens?.choiceLayer?.buttonTextColor);
  return variables;
}

function setVariable(variables: Record<string, string>, name: TsuzuruThemeCssVariableName, value: string | undefined) {
  if (value !== undefined) {
    variables[name] = value;
  }
}
