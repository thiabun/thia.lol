import { Compass, MessageCircle, Radio, Search, SearchX } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Avatar } from "../components/ui/Avatar";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { SearchField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { getSearchResults } from "../lib/api";
import { pageEntrance } from "../lib/motionPresets";
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
  const postResults = activeResults?.results.posts ?? [];
  const hasResults =
    profileResults.length > 0 || roomResults.length > 0 || postResults.length > 0;

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

    const count = profileResults.length + roomResults.length + postResults.length;
    const label = count === 1 ? "result" : "results";

    return `${count} ${label}`;
  }, [activeResults, hasResults, postResults.length, profileResults.length, roomResults.length]);

  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-4"
      data-testid="search-page"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Search"
        description="Search public profiles, rooms, and posts on thia.lol."
        path="/search"
      />

      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-normal text-text sm:text-3xl">
          Search
        </h1>
        <SearchField
          id="site-search"
          label="Search thia.lol"
          placeholder="Profiles, rooms, and posts"
          value={query}
          autoComplete="off"
          autoFocus
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      {trimmedQuery && !queryReady ? (
        <p className="text-sm text-muted">Use at least {minimumQueryLength} characters.</p>
      ) : null}

      {!trimmedQuery ? (
        <EmptyState
          icon={Search}
          title="Search thia.lol"
          text="Type a handle, name, room, or topic."
          actions={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink
                to="/discover"
                variant="secondary"
                size="sm"
                icon={<Compass aria-hidden="true" size={15} />}
              >
                Discover
              </ButtonLink>
              <ButtonLink
                to="/rooms"
                variant="secondary"
                size="sm"
                icon={<Radio aria-hidden="true" size={15} />}
              >
                Rooms
              </ButtonLink>
            </div>
          }
        />
      ) : null}

      {queryReady && loading ? (
        <ApiStateNotice
          kind="loading"
          title="Searching"
          text="Searching profiles, rooms, and posts."
        />
      ) : null}

      {queryReady && activeError ? (
        <ApiStateNotice
          kind="error"
          title="Search is not available"
          text="Try again in a moment."
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
        <div className="space-y-4" aria-live="polite">
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
          {postResults.length > 0 ? (
            <ResultGroup title="Posts" count={postResults.length}>
              <div className="grid gap-3 sm:grid-cols-2">
                {postResults.map((post) => (
                  <PostResult key={post.id} post={post} />
                ))}
              </div>
            </ResultGroup>
          ) : null}
        </div>
      ) : null}
    </motion.div>
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
    <section className="space-y-2.5" aria-label={title}>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-text">{title}</h2>
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
      <Panel interactive className="h-full p-3">
        <div className="flex gap-3">
          <Avatar user={profile.user} size="sm" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text">
              {profile.user.displayName}
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted">@{profile.user.handle}</p>
            {profile.bioSnippet ? (
              <p className="mt-1.5 line-clamp-1 text-sm leading-6 text-muted">
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
      <Panel interactive className="h-full p-3">
        <div className="flex gap-3">
          <RoomIcon room={room} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text">{room.name}</h3>
            <p className="mt-0.5 truncate text-sm text-muted">/{room.slug}</p>
            {room.description || room.summary ? (
              <p className="mt-1.5 line-clamp-1 text-sm leading-6 text-muted">
                {room.description || room.summary}
              </p>
            ) : null}
          </div>
        </div>
      </Panel>
    </Link>
  );
}

function PostResult({
  post,
}: {
  post: SearchResults["results"]["posts"][number];
}) {
  return (
    <Link
      to={post.canonicalPath}
      className="block rounded-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-testid="search-post-result"
    >
      <Panel interactive className="h-full p-3">
        <div className="flex gap-3">
          <Avatar user={post.author} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <h3 className="truncate font-semibold text-text">
                {post.author.displayName}
              </h3>
              <span className="truncate text-muted">@{post.author.handle}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted">
              {post.bodySnippet}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
              <MessageCircle aria-hidden="true" size={13} />
              {post.room ? `in ${post.room.name}` : "Profile post"}
            </p>
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
        className="size-10 shrink-0 rounded-card border border-white/35 bg-surface object-cover shadow-soft"
        src={room.iconUrl}
      />
    );
  }

  return (
    <div
      aria-label={room.name}
      role="img"
      className="grid size-10 shrink-0 place-items-center rounded-card border border-white/35 bg-surface-strong text-sm font-semibold text-text shadow-soft"
      title={room.name}
    >
      {room.name.trim().charAt(0).toUpperCase() || "#"}
    </div>
  );
}
