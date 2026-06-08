import { Compass, Hash, Radio, Search, Sparkles, UserRound } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { Avatar } from "../components/ui/Avatar";
import { getDiscover } from "../lib/api";
import { useAsyncData } from "../lib/useAsyncData";
import { users } from "../data/mockData";

const icons = {
  thread: Hash,
  person: UserRound,
  room: Radio,
};

export function DiscoverPage() {
  const { data, loading } = useAsyncData(getDiscover);
  const items = data ?? [];

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-5 sm:p-6">
          <Badge tone="cool">discover</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
            Find the rooms and signals with a living edge.
          </h1>
          <div className="mt-5 flex min-h-12 items-center gap-3 rounded-full border border-line bg-canvas/55 px-4 shadow-inner-soft">
            <Search aria-hidden="true" size={18} className="text-muted" />
            <label className="sr-only" htmlFor="discover-search">
              Search
            </label>
            <input
              id="discover-search"
              className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted/75"
              placeholder="Search people, rooms, fragments"
              type="search"
            />
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <img
            src="/ambient-veil.png"
            alt=""
            className="aspect-[16/10] w-full object-cover"
            loading="lazy"
          />
          <div className="p-5">
            <p className="text-sm font-semibold text-text">Platform field</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Warm discovery in Sunveil, cooler signal reading in Frostveil.
            </p>
          </div>
        </Panel>
      </section>

      {loading ? (
        <EmptyState
          icon={Compass}
          title="Gathering signals"
          text="The static fallback will appear as soon as the route settles."
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Discovery">
        {items.map((item) => {
          const Icon = icons[item.kind];
          return (
            <Panel key={item.id} interactive className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-11 place-items-center rounded-card bg-surface-strong text-accent-strong">
                  <Icon aria-hidden="true" size={19} />
                </div>
                <Badge>{item.count}</Badge>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-text">{item.label}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </Panel>
          );
        })}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text">Quiet operators</h2>
          <Badge tone="rose">
            <Sparkles aria-hidden="true" size={13} />
            curated
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {users.map((user) => (
            <Panel key={user.id} interactive className="p-4">
              <div className="flex items-center gap-3">
                <Avatar user={user} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">
                    {user.displayName}
                  </p>
                  <p className="truncate text-sm text-muted">@{user.handle}</p>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}
