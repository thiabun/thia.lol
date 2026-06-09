import { Image, LockKeyhole, Send, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../ui/Button";
import { SelectField, TextareaField } from "../ui/Field";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";
import { createPost } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import type { Post, Room } from "../../lib/types";

type ComposerProps = {
  rooms: Room[];
  onCreated: (post: Post) => void;
};

export function Composer({ rooms, onCreated }: ComposerProps) {
  const { csrfToken, status, user } = useAuth();
  const [body, setBody] = useState("");
  const [roomSlug, setRoomSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const activeRoomSlug = roomSlug || rooms[0]?.slug || "soft-launch";
  const activeRoomName =
    rooms.find((room) => room.slug === activeRoomSlug)?.name ?? "Soft Launch";
  const signedIn = status === "authenticated" && user && csrfToken;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!signedIn) {
      setError("Login to publish a post.");
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      const post = await createPost(
        {
          body,
          roomSlug: activeRoomSlug,
        },
        csrfToken,
      );

      setBody("");
      onCreated(post);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The post could not be published.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">New post</p>
          <p className="mt-1 text-xs text-muted">{activeRoomName} · public room</p>
        </div>
        <Badge tone="warm">
          <Sparkles aria-hidden="true" size={13} />
          gentle
        </Badge>
      </div>

      {!signedIn ? (
        <div className="mt-4 rounded-card border border-line bg-canvas/50 p-4">
          <p className="text-sm font-medium text-text">Login to publish.</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Public reading stays open; posting needs your account session.
          </p>
          <Link
            to="/login"
            className="mt-3 inline-flex text-sm font-medium text-accent-strong underline-offset-4 hover:underline"
          >
            Login
          </Link>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <TextareaField
            id="composer-body"
            name="body"
            label="Post body"
            hideLabel
            className="min-h-28 bg-canvas/50"
            placeholder="What wants to be shared?"
            value={body}
            maxLength={2000}
            disabled={!signedIn || submitting}
            onChange={(event) => setBody(event.currentTarget.value)}
            required
          />
          <SelectField
            id="composer-room"
            name="roomSlug"
            label="Room"
            options={rooms.map((room) => ({ value: room.slug, label: room.name }))}
            value={activeRoomSlug}
            disabled={!signedIn || submitting || rooms.length === 0}
            onChange={(event) => setRoomSlug(event.currentTarget.value)}
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Attach image"
              aria-label="Attach image"
              disabled
              icon={<Image aria-hidden="true" size={18} />}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Visibility"
              aria-label="Visibility"
              disabled
              icon={<LockKeyhole aria-hidden="true" size={18} />}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{body.length}/2000</span>
            <Button
              type="submit"
              disabled={!signedIn || submitting || body.trim().length === 0}
              icon={<Send aria-hidden="true" size={17} />}
            >
              {submitting ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </form>
    </Panel>
  );
}
