export interface TsuzuruHtmlNotice {
  readonly key: string;
  readonly message: string;
}

export interface TsuzuruHtmlNoticeSink {
  readonly add: (key: string, message: string, detail?: unknown) => void;
  readonly values: () => readonly TsuzuruHtmlNotice[];
  readonly clear: () => void;
}

export function createTsuzuruHtmlNoticeSink(onChange: () => void): TsuzuruHtmlNoticeSink {
  const notices = new Map<string, TsuzuruHtmlNotice>();

  return {
    add: (key, message, detail) => {
      if (notices.has(key)) {
        return;
      }
      notices.set(key, { key, message });
      if (detail === undefined) {
        console.warn(message);
      } else {
        console.warn(message, detail);
      }
      onChange();
    },
    values: () => [...notices.values()],
    clear: () => {
      notices.clear();
      onChange();
    },
  };
}
