import { Search, SearchX } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SearchField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { getSearchResults } from "../lib/api";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type { Room, SearchResults } from "../lib/types";

const minimumQueryLength = 2;

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loadingQuery, setLoadingQuery] = useState<string | null>(null);
  const [error, setError] = useState<{ query: string; message: string } | null>(null);
  const trimmedQuery = query.trim();
  const queryReady = trimmedQuery.length >= minimumQueryLength;
  const activeResults = results?.query === trimmedQuery ? results : null;
  const activeError = error?.query === trimmedQuery ? error.message : null;
  const loading = loadingQuery === trimmedQuery;
  const profileResults = activeResults?.results.profiles ?? [];
  const roomResults = activeResults?.results.rooms ?? [];
  const hasResults = profileResults.length > 0 || roomResults.length > 0;

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    } else {
      params.delete("q");
    }

    const next = params.toString();
    const current = searchParams.toString();

    if (next !== current) {
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams, trimmedQuery]);

  useEffect(() => {
    let active = true;

    if (!queryReady) {
      return () => {
        active = false;
      };
    }

    const timeout = window.setTimeout(() => {
      setLoadingQuery(trimmedQuery);
      setError(null);

      getSearchResults(trimmedQuery)
        .then((nextResults) => {
          if (active) {
            setResults(nextResults);
            setError(null);
          }
        })
        .catch((caught: unknown) => {
          if (active) {
            setResults(null);
            setError({
              query: trimmedQuery,
              message:
                caught instanceof Error
                  ? caught.message
                  : "Could not search right now.",
            });
          }
        })
        .finally(() => {
          if (active) {
            setLoadingQuery(null);
          }
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [queryReady, trimmedQuery]);

  const resultSummary = useMemo(() => {
    if (!activeResults || !hasResults) {
      return "";
    }

    const count = profileResults.length + roomResults.length;
    const label = count === 1 ? "result" : "results";

    return `${count} ${label} for "${activeResults.query}"`;
  }, [activeResults, hasResults, profileResults.length, roomResults.length]);

  return (
    <motion.div
      className="mx-auto max-w-5xl space-y-6"
      data-testid="search-page"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Search"
        description="Search public profiles and rooms on thia.lol."
        path="/search"
      />

      <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
        <Panel className="p-5 sm:p-6">
          <div className="max-w-3xl">
            <Badge tone="cool">search</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
              Search thia.lol.
            </h1>
            <p className="mt-3 text-base leading-7 text-muted">
              Find public profiles and rooms by name, handle, slug, or description.
            </p>
          </div>
          <SearchField
            id="site-search"
            label="Search thia.lol"
            placeholder="Search profiles and rooms"
            className="mt-5"
            value={query}
            autoComplete="off"
            autoFocus
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </Panel>
      </motion.div>

      {!trimmedQuery ? (
        <EmptyState
          icon={Search}
          title="Start with a name or room"
          text="Search uses public profile and room data only."
        />
      ) : null}

      {trimmedQuery && !queryReady ? (
        <EmptyState
          icon={Search}
          title="Keep typing"
          text={`Enter at least ${minimumQueryLength} characters to search.`}
        />
      ) : null}

      {queryReady && loading ? (
        <SearchNotice title="Searching" text="Looking through public profiles and rooms." />
      ) : null}

      {queryReady && activeError ? (
        <SearchNotice
          title="Search is not available"
          text="Try again in a moment."
          tone="rose"
        />
      ) : null}

      {queryReady && !loading && !activeError && activeResults && !hasResults ? (
        <EmptyState
          icon={SearchX}
          title="No results found"
          text="Try a shorter search or check the spelling."
        />
      ) : null}

      {queryReady && !loading && !activeError && hasResults ? (
        <div className="space-y-6" aria-live="polite">
          <p className="text-sm font-medium text-muted">{resultSummary}</p>
          {profileResults.length > 0 ? (
            <ResultGroup title="Profiles" count={profileResults.length}>
              <div className="grid gap-3 sm:grid-cols-2">
                {profileResults.map((profile) => (
                  <ProfileResult
                    key={profile.user.handle}
                    profile={profile}
                  />
                ))}
              </div>
            </ResultGroup>
          ) : null}
          {roomResults.length > 0 ? (
            <ResultGroup title="Rooms" count={roomResults.length}>
              <div className="grid gap-3 sm:grid-cols-2">
                {roomResults.map((room) => (
                  <RoomResult key={room.slug} room={room} />
                ))}
              </div>
            </ResultGroup>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

function SearchNotice({
  text,
  title,
  tone = "cool",
}: {
  text: string;
  title: string;
  tone?: "cool" | "rose";
}) {
  return (
    <Panel className="p-4">
      <Badge tone={tone}>{tone === "rose" ? "notice" : "loading"}</Badge>
      <h2 className="mt-3 text-sm font-semibold text-text">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
    </Panel>
  );
}

function ResultGroup({
  children,
  count,
  title,
}: {
  children: ReactNode;
  count: number;
  title: string;
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs font-medium text-muted">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function ProfileResult({
  profile,
}: {
  profile: SearchResults["results"]["profiles"][number];
}) {
  return (
    <Link
      to={`/@${profile.user.handle}`}
      className="block rounded-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-testid="search-profile-result"
    >
      <Panel interactive className="h-full p-4">
        <div className="flex gap-3">
          <Avatar user={profile.user} size="md" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text">
              {profile.user.displayName}
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted">@{profile.user.handle}</p>
            {profile.bioSnippet ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                {profile.bioSnippet}
              </p>
            ) : null}
          </div>
        </div>
      </Panel>
    </Link>
  );
}

function RoomResult({ room }: { room: Room }) {
  return (
    <Link
      to={`/rooms/${room.slug}`}
      className="block rounded-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-testid="search-room-result"
    >
      <Panel interactive className="h-full p-4">
        <div className="flex gap-3">
          <RoomIcon room={room} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text">{room.name}</h3>
            <p className="mt-0.5 truncate text-sm text-muted">/{room.slug}</p>
            {room.description || room.summary ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                {room.description || room.summary}
              </p>
            ) : null}
          </div>
        </div>
      </Panel>
    </Link>
  );
}

function RoomIcon({ room }: { room: Room }) {
  if (room.iconUrl) {
    return (
      <img
        alt={room.name}
        className="size-11 shrink-0 rounded-card border border-white/35 bg-surface object-cover shadow-soft"
        src={room.iconUrl}
      />
    );
  }

  return (
    <div
      aria-label={room.name}
      role="img"
      className="grid size-11 shrink-0 place-items-center rounded-card border border-white/35 bg-surface-strong text-sm font-semibold text-text shadow-soft"
      title={room.name}
    >
      {room.name.trim().charAt(0).toUpperCase() || "#"}
    </div>
  );
}
