import type { TsuzuruTheme } from "@tsuzuru/standard-ui-preact";

export const localTheme = {
  id: "local",
  name: "Local",
  tokens: {
    colors: {
      surface: "rgba(18, 24, 30, 0.9)",
      surfaceBorder: "rgba(139, 212, 199, 0.46)",
      text: "#fff4dc",
      mutedText: "rgba(255, 244, 220, 0.72)",
      accent: "#8bd4c7",
    },
    typography: {
      fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", ui-serif, Georgia, serif',
    },
    shadow: {
      window: "0 22px 54px rgba(0, 0, 0, 0.42)",
      choice: "0 22px 54px rgba(0, 0, 0, 0.36)",
    },
    messageWindow: {
      background: "rgba(18, 24, 30, 0.9)",
      borderColor: "rgba(139, 212, 199, 0.46)",
    },
    choiceLayer: {
      background: "rgba(18, 24, 30, 0.86)",
      borderColor: "rgba(139, 212, 199, 0.5)",
      buttonBackground: "rgba(255, 244, 220, 0.08)",
      buttonHoverBackground: "rgba(62, 115, 108, 0.58)",
    },
  },
} satisfies TsuzuruTheme;
