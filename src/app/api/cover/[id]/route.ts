/**
 * Generated cover art for a record.
 *
 * A CV carries no images, so a freshly imported archive would be a grid of
 * empty boxes. Rather than ship stock photography or hotlink someone else's
 * pictures, every record gets a deterministic monochrome composition derived
 * from its own id and type — the same record always draws the same image, and
 * a real photograph replaces it the moment an archivist adds one.
 *
 * SVG, so it costs no bytes to store and scales to any card size.
 */

const WIDTH = 800;
const HEIGHT = 600;

/** FNV-1a: small, stable, and identical across runs and machines. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function generator(seed: number) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/** Each record type gets its own mark, so the grid reads as a typology. */
function shapes(type: string, random: () => number): string {
  const ink = "#0b0b0b";
  const parts: string[] = [];

  const jitter = (base: number, spread: number) => base + (random() - 0.5) * spread;

  switch (type) {
    case "exhibition":
    case "collaboration": {
      const count = 3 + Math.floor(random() * 3);
      for (let i = 0; i < count; i += 1) {
        const w = jitter(180, 120);
        const h = jitter(180, 120);
        parts.push(
          `<rect x="${jitter(WIDTH / 2, 420) - w / 2}" y="${jitter(HEIGHT / 2, 280) - h / 2}" width="${w}" height="${h}" fill="none" stroke="${ink}" stroke-width="${jitter(3, 3)}"/>`,
        );
      }
      break;
    }
    case "residency":
    case "commission": {
      const rings = 3 + Math.floor(random() * 3);
      for (let i = 0; i < rings; i += 1) {
        parts.push(
          `<circle cx="${jitter(WIDTH / 2, 260)}" cy="${jitter(HEIGHT / 2, 200)}" r="${jitter(120, 150)}" fill="none" stroke="${ink}" stroke-width="${jitter(2.5, 2)}"/>`,
        );
      }
      break;
    }
    case "publication":
    case "talk": {
      const lines = 6 + Math.floor(random() * 8);
      for (let i = 0; i < lines; i += 1) {
        const y = (HEIGHT / (lines + 1)) * (i + 1);
        parts.push(
          `<line x1="${jitter(140, 160)}" y1="${y}" x2="${jitter(660, 200)}" y2="${y}" stroke="${ink}" stroke-width="${jitter(3, 3)}"/>`,
        );
      }
      break;
    }
    case "award":
    case "collection": {
      const points = 5 + Math.floor(random() * 4);
      const path: string[] = [];
      for (let i = 0; i < points; i += 1) {
        path.push(`${jitter(WIDTH / 2, 500)},${jitter(HEIGHT / 2, 360)}`);
      }
      parts.push(
        `<polygon points="${path.join(" ")}" fill="none" stroke="${ink}" stroke-width="3"/>`,
      );
      break;
    }
    default: {
      const strokes = 4 + Math.floor(random() * 5);
      for (let i = 0; i < strokes; i += 1) {
        parts.push(
          `<path d="M ${jitter(120, 120)} ${jitter(HEIGHT / 2, 340)} Q ${jitter(WIDTH / 2, 300)} ${jitter(HEIGHT / 2, 400)} ${jitter(680, 120)} ${jitter(HEIGHT / 2, 340)}" fill="none" stroke="${ink}" stroke-width="${jitter(3, 3)}"/>`,
        );
      }
    }
  }

  return parts.join("");
}

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const type = new URL(request.url).searchParams.get("type") ?? "other";

  const random = generator(hash(`${id}:${type}`));
  const tone = 244 + Math.floor(random() * 10);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Generated cover">
<rect width="${WIDTH}" height="${HEIGHT}" fill="rgb(${tone},${tone},${tone - 3})"/>
<g opacity="0.92">${shapes(type, random)}</g>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Deterministic output, so it can be cached hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
