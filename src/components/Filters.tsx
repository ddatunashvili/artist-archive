import Link from "next/link";
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/schema";
import type { CatalogueFilters } from "@/lib/queries";

type Options = {
  types: { value: EntryType; count: number }[];
  years: number[];
  countries: string[];
  cities: string[];
  artists: { name: string; slug: string }[];
};

/**
 * A plain GET form: filters live in the URL, so every view is linkable and
 * the catalogue works without client-side JavaScript.
 */
export function Filters({ options, active }: { options: Options; active: CatalogueFilters }) {
  const hasActive = Object.values(active).some(Boolean);

  return (
    <form className="filters" method="get" action="/">
      <div className="field">
        <label htmlFor="q">Search</label>
        <input id="q" name="q" type="search" defaultValue={active.q ?? ""} placeholder="Title, venue…" />
      </div>

      <div className="field">
        <label htmlFor="type">Type</label>
        <select id="type" name="type" defaultValue={active.type ?? ""}>
          <option value="">All types</option>
          {options.types.map((type) => (
            <option key={type.value} value={type.value}>
              {ENTRY_TYPE_LABELS[type.value]} ({type.count})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="year">Year</label>
        <select id="year" name="year" defaultValue={active.year ?? ""}>
          <option value="">All years</option>
          {options.years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="country">Location — country</label>
        <select id="country" name="country" defaultValue={active.country ?? ""}>
          <option value="">All countries</option>
          {options.countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="city">Location — city</label>
        <select id="city" name="city" defaultValue={active.city ?? ""}>
          <option value="">All cities</option>
          {options.cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="artist">Artist</label>
        <select id="artist" name="artist" defaultValue={active.artist ?? ""}>
          <option value="">All artists</option>
          {options.artists.map((artist) => (
            <option key={artist.slug} value={artist.slug}>
              {artist.name}
            </option>
          ))}
        </select>
      </div>

      <div className="actions">
        <button type="submit">Apply</button>
        {hasActive && (
          <Link href="/" className="button ghost">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
