import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { LoaderCircle, UsersRound } from "lucide-react";
import { getChatMessageReactionDetails } from "../../lib/api";
import type { ChatMessageReactionDetails as ReactionDetails } from "../../lib/types";
import { UserIdentityLink } from "../social/UserProfileLink";
import { ModalSheet, ModalSheetStatus } from "../ui/ModalSheet";
import { messageReactionEmojiLabel } from "./messageReactionEmoji";

export type MessageReactionDetailsProps = {
  messageId: number;
  onClose: () => void;
  open: boolean;
  reactionVersion: number;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function MessageReactionDetails({
  messageId,
  onClose,
  open,
  reactionVersion,
  returnFocusRef,
}: MessageReactionDetailsProps) {
  const firstUserRef = useRef<HTMLDivElement>(null);
  const [request, setRequest] = useState<{
    details?: ReactionDetails;
    error?: string;
    messageId: number;
    requestedReactionVersion: number;
    state: "idle" | "loading" | "loaded" | "error";
  }>({ messageId, requestedReactionVersion: -1, state: "idle" });

  useEffect(() => {
    if (!open || messageId <= 0) {
      return undefined;
    }

    let active = true;

    getChatMessageReactionDetails(messageId)
      .then((result) => {
        if (active) {
          setRequest({
            details: result,
            messageId,
            requestedReactionVersion: reactionVersion,
            state: "loaded",
          });
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setRequest({
            error:
              caught instanceof Error
                ? caught.message
                : "Reactions could not load.",
            messageId,
            requestedReactionVersion: reactionVersion,
            state: "error",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [messageId, open, reactionVersion]);

  const requestMatchesMessage =
    request.messageId === messageId &&
    request.requestedReactionVersion >= reactionVersion;
  const details = requestMatchesMessage ? request.details : undefined;
  const error = requestMatchesMessage ? request.error : undefined;
  const loading = open && (
    !requestMatchesMessage ||
    request.state === "idle" ||
    request.state === "loading"
  );
  const hasGroups = Boolean(details?.groups.length);

  return (
    <ModalSheet
      description="People who reacted to this message."
      {...(hasGroups ? { initialFocusRef: firstUserRef } : {})}
      mobile="sheet"
      onClose={() => {
        setRequest({
          messageId,
          requestedReactionVersion: -1,
          state: "idle",
        });
        onClose();
      }}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      size="sm"
      testId="message-reaction-details"
      title="Message reactions"
    >
      {loading ? (
        <div
          className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
          Loading reactions
        </div>
      ) : null}

      {error ? (
        <ModalSheetStatus tone="error">{error}</ModalSheetStatus>
      ) : null}

      {!loading && !error && !hasGroups ? (
        <div className="grid min-h-32 place-items-center text-center text-muted">
          <div>
            <UsersRound aria-hidden="true" className="mx-auto mb-2" size={22} />
            <p className="text-sm font-medium">No reactions yet.</p>
          </div>
        </div>
      ) : null}

      {!loading && !error && details ? (
        <div className="space-y-5">
          {details.groups.map((group, groupIndex) => (
            <section key={group.emoji} aria-labelledby={`reaction-${messageId}-${groupIndex}`}>
              <h3
                id={`reaction-${messageId}-${groupIndex}`}
                className="flex items-center gap-2 text-sm font-semibold text-text"
              >
                <span className="sr-only">
                  {messageReactionEmojiLabel(group.emoji)} reaction:
                </span>
                <span aria-hidden="true" className="text-lg">{group.emoji}</span>
                <span>{group.count}</span>
                {group.reactedByMe ? (
                  <span className="font-normal text-muted">You reacted</span>
                ) : null}
              </h3>
              <div
                ref={groupIndex === 0 ? firstUserRef : undefined}
                className="mt-2 grid gap-1"
                tabIndex={groupIndex === 0 ? -1 : undefined}
              >
                {group.users.map((user) => (
                  <UserIdentityLink
                    key={user.id}
                    className="px-2 py-2 hover:bg-surface-strong/60"
                    user={user}
                  />
                ))}
                {group.count > group.users.length ? (
                  <p className="px-2 py-1 text-xs text-muted">
                    {group.count - group.users.length} more
                  </p>
                ) : null}
              </div>
            </section>
          ))}
          {details.truncated ? (
            <ModalSheetStatus>
              This list is limited to the first 500 reactions.
            </ModalSheetStatus>
          ) : null}
        </div>
      ) : null}
    </ModalSheet>
  );
}
