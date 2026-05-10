import type { RuntimeState } from "@tsuzuru/core";
import { getStdVisualState, type StdVisualSpritePosition, type StdVisualTransition } from "@tsuzuru/plugin-std-visual";
import type { TsuzuruHtmlAssets } from "./assets-loader.js";
import type { TsuzuruHtmlNoticeSink } from "./notices.js";

export interface TsuzuruHtmlVisualLayer {
  readonly layer: HTMLElement;
  readonly background: HTMLElement;
  readonly sprites: HTMLElement;
}

export function createTsuzuruHtmlVisualLayer(document: Document): TsuzuruHtmlVisualLayer {
  const layer = document.createElement("div");
  layer.className = "tzr-html-visual-layer";
  layer.setAttribute("aria-label", "std-visual layer");

  const background = document.createElement("div");
  background.className = "tzr-html-background";

  const sprites = document.createElement("div");
  sprites.className = "tzr-html-sprite-layer";

  layer.append(background, sprites);
  return { layer, background, sprites };
}

export function renderTsuzuruHtmlVisualLayer(
  visualLayer: TsuzuruHtmlVisualLayer,
  runtimeState: RuntimeState,
  assets: TsuzuruHtmlAssets | null,
  notices: TsuzuruHtmlNoticeSink,
): void {
  let visualState: ReturnType<typeof getStdVisualState>;
  try {
    visualState = getStdVisualState(runtimeState);
  } catch {
    visualLayer.background.replaceChildren();
    visualLayer.sprites.replaceChildren();
    return;
  }

  visualLayer.background.replaceChildren(
    ...createBackgroundNodes(
      visualLayer.background.ownerDocument,
      visualState.background?.assetId ?? null,
      assets,
      notices,
    ),
  );
  applyTransition(visualLayer.background, visualState.background?.transition);

  visualLayer.sprites.replaceChildren(
    ...Object.entries(visualState.sprites).map(([assetId, sprite]) =>
      createSpriteNode(visualLayer.sprites.ownerDocument, assetId, sprite.position, sprite.transition, assets, notices),
    ),
  );
}

function createBackgroundNodes(
  document: Document,
  assetId: string | null,
  assets: TsuzuruHtmlAssets | null,
  notices: TsuzuruHtmlNoticeSink,
): readonly HTMLElement[] {
  if (assetId === null) {
    return [];
  }

  const asset = assets?.visual.backgrounds[assetId];
  if (asset === undefined) {
    notices.add(`visual:background:missing:${assetId}`, `Background asset is not mapped: ${assetId}`);
    return [createPlaceholder(document, "tzr-html-background__placeholder", `Missing background: ${assetId}`)];
  }

  const image = document.createElement("img");
  image.className = "tzr-html-background__image";
  image.setAttribute("src", asset.src);
  image.setAttribute("alt", asset.alt ?? assetId);
  return [image];
}

function createSpriteNode(
  document: Document,
  assetId: string,
  position: StdVisualSpritePosition,
  transition: StdVisualTransition | undefined,
  assets: TsuzuruHtmlAssets | null,
  notices: TsuzuruHtmlNoticeSink,
): HTMLElement {
  const sprite = document.createElement("div");
  sprite.className = joinClassNames("tzr-html-sprite", `tzr-html-sprite--${position}`);
  applyTransition(sprite, transition);

  const asset = assets?.visual.sprites[assetId];
  if (asset === undefined) {
    notices.add(`visual:sprite:missing:${assetId}`, `Sprite asset is not mapped: ${assetId}`);
    sprite.append(createPlaceholder(document, "tzr-html-sprite__placeholder", `Missing sprite: ${assetId}`));
    return sprite;
  }

  const image = document.createElement("img");
  image.className = "tzr-html-sprite__image";
  image.setAttribute("src", asset.src);
  image.setAttribute("alt", asset.alt ?? assetId);
  sprite.append(image);
  return sprite;
}

function createPlaceholder(document: Document, className: string, text: string): HTMLElement {
  const placeholder = document.createElement("div");
  placeholder.className = className;
  placeholder.textContent = text;
  return placeholder;
}

function applyTransition(element: HTMLElement, transition: StdVisualTransition | undefined): void {
  if (transition === undefined) {
    element.removeAttribute("data-tzr-html-transition");
    element.removeAttribute("style");
    return;
  }

  element.setAttribute("data-tzr-html-transition", transition.type);
  element.setAttribute("style", `--tzr-html-transition-ms: ${transition.durationMs}ms`);
}

function joinClassNames(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter((className) => className !== undefined && className.length > 0).join(" ");
}
