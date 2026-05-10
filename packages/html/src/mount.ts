export interface TsuzuruHtmlMountOptions {
  readonly title?: string;
  readonly className?: string;
}

export interface TsuzuruHtmlApp {
  readonly root: HTMLElement;
  readonly element: HTMLElement;
  readonly destroy: () => void;
  readonly isDestroyed: () => boolean;
}

const DEFAULT_TITLE = "Tsuzuru";

export async function mountTsuzuruHtml(
  root: HTMLElement,
  options: TsuzuruHtmlMountOptions = {},
): Promise<TsuzuruHtmlApp> {
  const document = root.ownerDocument;
  const element = document.createElement("section");
  element.className = joinClassNames("tzr-html-player", options.className);
  element.setAttribute("data-tsuzuru-html-state", "mounted");

  const viewport = document.createElement("div");
  viewport.className = "tzr-html-viewport";

  const title = document.createElement("h1");
  title.className = "tzr-html-title";
  title.textContent = options.title ?? DEFAULT_TITLE;

  const status = document.createElement("p");
  status.className = "tzr-html-status";
  status.textContent = "HTML adapter mounted.";

  viewport.append(title, status);
  element.append(viewport);
  root.replaceChildren(element);

  let destroyed = false;

  return {
    root,
    element,
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      element.setAttribute("data-tsuzuru-html-state", "destroyed");
      if (element.parentNode === root) {
        root.replaceChildren();
      }
    },
    isDestroyed: () => destroyed,
  };
}

function joinClassNames(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter((className) => className !== undefined && className.length > 0).join(" ");
}
