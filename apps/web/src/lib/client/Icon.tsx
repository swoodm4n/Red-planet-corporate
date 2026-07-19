// Reusable pixel-art icon. Renders a green-phosphor PNG from /public/icons at a
// consistent, crisp (nearest-neighbour) size. Display-only; no game logic.
import {
  buildingIcon,
  resourceIcon,
  personnelIcon,
  hullIcon,
} from "@/lib/client/icons";

export function Icon({
  name,
  alt,
  size = 18,
  className,
  style,
}: {
  /** Icon filename without extension, e.g. "power-facility". */
  name: string;
  alt?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/${name}.png`}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      width={size}
      height={size}
      className={`icon${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, ...style }}
      draggable={false}
    />
  );
}

/** Building icon that falls back to nothing if the type is unmapped. */
export function BuildingIcon({ type, size = 18, style }: { type: string; size?: number; style?: React.CSSProperties }) {
  const name = buildingIcon(type);
  if (!name) return null;
  return <Icon name={name} alt={type} size={size} style={style} />;
}

export function ResourceIcon({ resource, size = 18, style }: { resource: string; size?: number; style?: React.CSSProperties }) {
  const name = resourceIcon(resource);
  if (!name) return null;
  return <Icon name={name} alt={resource} size={size} style={style} />;
}

export function PersonnelIcon({ type, size = 18, style }: { type: string; size?: number; style?: React.CSSProperties }) {
  const name = personnelIcon(type);
  if (!name) return null;
  return <Icon name={name} alt={type} size={size} style={style} />;
}

export function HullIcon({ hull, size = 18, style }: { hull: string; size?: number; style?: React.CSSProperties }) {
  const name = hullIcon(hull);
  if (!name) return null;
  return <Icon name={name} alt={hull} size={size} style={style} />;
}
