import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Search, WifiOff } from "lucide-react";
import { GifIcon } from "../icons/GifIcon";
import { Button } from "../ui/Button";
import { CompactStateNotice } from "../ui/RouteState";
import { getTrendingGifs, searchGifs } from "../../lib/api";
import { cn } from "../../lib/classNames";
import type { GifSearchResponse, GifSearchResult } from "../../lib/types";

type GifPickerProps = {
  className?: string;
  onSelect: (gif: GifSearchResult) => void;
};

export function GifPicker({ className, onSelect }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GifSearchResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(undefined);

      const request = normalizedQuery
        ? searchGifs(normalizedQuery, { limit: 24 })
        : getTrendingGifs({ limit: 24 });

      request
        .then((nextResult) => {
          if (active) {
            setResult(nextResult);
          }
        })
        .catch((requestError: unknown) => {
          if (active) {
            setError(requestError instanceof Error ? requestError.message : "GIF search is unavailable.");
            setResult(undefined);
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, normalizedQuery ? 220 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [normalizedQuery]);

  return (
    <div className={cn("rounded-panel border border-line bg-surface p-3 shadow-soft", className)}>
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search KLIPY GIFs</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            size={15}
          />
          <input
            className="min-h-9 w-full rounded-control border border-line bg-canvas/70 pl-8 pr-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="Search KLIPY GIFs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className="shrink-0 rounded-control border border-line bg-canvas/60 px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
          KLIPY
        </span>
      </div>

      <div className="mt-3 min-h-36">
        {loading ? (
          <CompactStateNotice
            icon={LoaderCircle}
            kind="loading"
            text="Loading GIFs."
            title="Loading"
          />
        ) : null}

        {!loading && error ? (
          <CompactStateNotice
            icon={WifiOff}
            kind="error"
            text={error}
            title="GIF search failed"
          />
        ) : null}

        {!loading && result && !result.available ? (
          <CompactStateNotice
            icon={WifiOff}
            text="GIF search is unavailable."
            title="KLIPY unavailable"
          />
        ) : null}

        {!loading && result?.available && result.items.length === 0 ? (
          <CompactStateNotice
            icon={GifIcon}
            testId="gif-picker-empty"
            text="No GIFs found."
            title="No results"
          />
        ) : null}

        {!loading && result?.available && result.items.length > 0 ? (
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3" data-testid="gif-picker-results">
            {result.items.map((gif) => (
              <Button
                key={gif.id}
                type="button"
                variant="ghost"
                className="group min-h-0 overflow-hidden rounded-card border border-line bg-canvas/70 p-0 hover:border-accent/50"
                aria-label={`Select GIF ${gif.title}`}
                title={gif.title}
                onClick={() => onSelect(gif)}
              >
                <img
                  src={gif.previewUrl ?? gif.url}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
