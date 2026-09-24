import './MapEmbed.css';

/**
 * The map preview, from a link somebody pasted off a maps app.
 *
 * Only ever drawn once there is an embed URL. An empty map centred on nothing
 * is worse than no map: it reads as a wrong address rather than as one nobody
 * has pasted a link for yet.
 *
 * The URL was checked on the way in - it can only be a Google Maps or
 * OpenStreetMap embed - because this is the one piece of company-supplied
 * text a student's browser goes and loads something from.
 */
export default function MapEmbed({
  embedUrl,
  mapsLink,
  label,
  height = 220,
}: {
  embedUrl: string;
  /** The share link, for opening the real thing and getting directions. */
  mapsLink?: string | null;
  label: string;
  height?: number;
}) {
  return (
    <figure className="map-embed" style={{ ['--map-h' as string]: `${height}px` }}>
      <iframe
        title={`Map showing ${label}`}
        src={embedUrl}
        loading="lazy"
        // Nothing in the frame needs to reach back into the page, and the
        // referrer would tell the map host which role somebody is looking at.
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />

      {mapsLink && (
        <figcaption>
          <a href={mapsLink} target="_blank" rel="noopener noreferrer">
            Open in maps ↗
          </a>
          <a href={mapsLink} target="_blank" rel="noopener noreferrer">
            Get directions ↗
          </a>
        </figcaption>
      )}
    </figure>
  );
}
