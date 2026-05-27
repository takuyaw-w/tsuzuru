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
      backdropFilter: "blur(12px) saturate(1.08)",
      speakerRadius: "999px",
      speakerPadding: "5px 15px",
      speakerShadow: "0 6px 18px rgba(0, 0, 0, 0.2)",
    },
    choiceLayer: {
      background: "rgba(18, 24, 30, 0.86)",
      borderColor: "rgba(139, 212, 199, 0.5)",
      gap: "10px",
      buttonBackground: "rgba(255, 244, 220, 0.08)",
      buttonHoverBackground: "rgba(62, 115, 108, 0.58)",
      buttonPadding: "10px 16px",
      buttonShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
    },
  },
} satisfies TsuzuruTheme;
