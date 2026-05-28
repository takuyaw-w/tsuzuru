import type { StdHotspot, StdHotspots } from "@tsuzuru/plugin-std-hotspot";
import type { ComponentChildren, ComponentProps } from "preact";
import { joinClassNames } from "./class-name.js";

type ButtonClickHandler = NonNullable<ComponentProps<"button">["onClick"]>;
type ButtonStyle = Extract<NonNullable<ComponentProps<"button">["style"]>, object>;

const HOTSPOT_BASE_WIDTH = 960;
const HOTSPOT_BASE_HEIGHT = 540;

export interface StdHotspotLayerProps {
  readonly hotspots: StdHotspots;
  readonly waiting?: boolean | undefined;
  readonly onHotspot?: ((id: string, hotspot: StdHotspot) => void) | undefined;
  readonly className?: string | undefined;
}

export function StdHotspotLayer({
  hotspots,
  waiting = false,
  onHotspot,
  className,
}: StdHotspotLayerProps): ComponentChildren {
  const entries = Object.entries(hotspots);
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={joinClassNames("tzr-std-hotspot-layer", className)} aria-hidden={waiting ? undefined : "true"}>
      {entries.map(([id, hotspot]) => (
        <button
          key={id}
          type="button"
          className="tzr-std-hotspot-layer__button"
          aria-label={`Hotspot ${id}`}
          disabled={!waiting}
          style={hotspotButtonStyle(hotspot) as ButtonStyle}
          {...(waiting && onHotspot !== undefined
            ? { onClick: createHotspotClickHandler(id, hotspot, onHotspot) }
            : {})}
        />
      ))}
    </div>
  );
}

function hotspotButtonStyle(hotspot: StdHotspot): ButtonStyle {
  const shape = hotspot.shape;
  return {
    left: `${(shape.x / HOTSPOT_BASE_WIDTH) * 100}%`,
    top: `${(shape.y / HOTSPOT_BASE_HEIGHT) * 100}%`,
    width: `${(shape.width / HOTSPOT_BASE_WIDTH) * 100}%`,
    height: `${(shape.height / HOTSPOT_BASE_HEIGHT) * 100}%`,
  };
}

function createHotspotClickHandler(
  id: string,
  hotspot: StdHotspot,
  onHotspot: (id: string, hotspot: StdHotspot) => void,
): ButtonClickHandler {
  return (event) => {
    event.stopPropagation();
    onHotspot(id, hotspot);
  };
}
