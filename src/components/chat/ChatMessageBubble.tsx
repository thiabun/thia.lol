import {
  memo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { MessageCirclePlus, MoreHorizontal, UsersRound } from "lucide-react";
import type { ChatMessage } from "../../lib/types";
import { cn } from "../../lib/classNames";
import { parseApiTimestamp } from "../../lib/dates";
import { ReportForm } from "../social/ReportForm";
import { RichText } from "../social/RichText";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ModalSheet } from "../ui/ModalSheet";
import { MessageAttachments } from "./MessageAttachments";
import { messageTextForDisplay } from "./messageAttachmentDisplay";
import { MessageReactionDetails } from "./MessageReactionDetails";
import { MessageReactionPicker } from "./MessageReactionPicker";
import {
  messageReactionEmojiLabel,
} from "./messageReactionEmoji";

export type ChatMessageBubbleProps = {
  canReact: boolean;
  canReport: boolean;
  error?: string;
  message: ChatMessage;
  mine: boolean;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  pendingEmojis?: ReadonlySet<string>;
  variant: "direct" | "room";
};

export const ChatMessageBubble = memo(function ChatMessageBubble({
  canReact,
  canReport,
  error,
  message,
  mine,
  onToggleReaction,
  pendingEmojis,
  variant,
}: ChatMessageBubbleProps) {
  const addReactionButtonRef = useRef<HTMLButtonElement>(null);
  const detailsButtonRef = useRef<HTMLButtonElement>(null);
  const mobileActionsButtonRef = useRef<HTMLButtonElement>(null);
  const pickerReturnFocusRef = useRef<HTMLElement | null>(null);
  const detailsReturnFocusRef = useRef<HTMLElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const available = message.id > 0 && message.deletedAt == null;
  const reactingAllowed = available && canReact;
  const reportingAllowed = available && canReport;
  const busyEmoji = message.reactions.find((reaction) =>
    pendingEmojis?.has(reaction.emoji),
  )?.emoji;
  const hasPendingReaction = Boolean(pendingEmojis?.size);

  function toggleReaction(emoji: string) {
    onToggleReaction(message, emoji);
  }

  function openPickerFromMobileActions() {
    pickerReturnFocusRef.current = mobileActionsButtonRef.current;
    setMobileActionsOpen(false);
    setPickerOpen(true);
  }

  function openDetailsFromMobileActions() {
    detailsReturnFocusRef.current = mobileActionsButtonRef.current;
    setMobileActionsOpen(false);
    setDetailsOpen(true);
  }

  function openPickerFromDesktop() {
    pickerReturnFocusRef.current = addReactionButtonRef.current;
    setPickerOpen(true);
  }

  function openDetailsFromDesktop() {
    detailsReturnFocusRef.current = detailsButtonRef.current;
    setDetailsOpen(true);
  }

  return (
    <div
      className={cn(
        "group/message flex items-end gap-2",
        mine ? "justify-end" : "justify-start",
      )}
      data-message-id={message.id}
    >
      {mine ? null : (
        <Avatar user={message.sender} size="sm" className="mb-1 hidden sm:block" />
      )}
      <div
        className={cn(
          "mb-1 flex min-w-0 w-full max-w-[min(42rem,94%)] flex-col sm:max-w-[min(44rem,86%)]",
          mine ? "items-end" : "items-start",
        )}
      >
        {variant === "room" && !mine ? (
          <span className="mb-1 block truncate px-1 text-[0.7rem] font-semibold text-muted">
            {message.sender.displayName}
          </span>
        ) : null}

        <div
          className={cn(
            "relative flex w-fit max-w-full flex-col",
            mine ? "items-end" : "items-start",
          )}
        >
          {message.deletedAt != null ? (
            <div className="rounded-[1.125rem] border border-line/80 bg-surface/55 px-3 py-2 text-sm italic text-muted">
              Message unavailable
            </div>
          ) : (
            <MessageContent message={message} mine={mine} variant={variant} />
          )}

          {available && (reactingAllowed || message.reactions.length > 0 || reportingAllowed) ? (
            <DesktopMessageActionControls
              addReactionButtonRef={addReactionButtonRef}
              canReact={reactingAllowed}
              canReport={reportingAllowed}
              detailsButtonRef={detailsButtonRef}
              hasPendingReaction={hasPendingReaction}
              message={message}
              mine={mine}
              onOpenDetails={openDetailsFromDesktop}
              onOpenPicker={openPickerFromDesktop}
            />
          ) : null}
        </div>

        <div
          className={cn(
            "mt-1 flex max-w-full flex-wrap items-center gap-1",
            mine && "justify-end",
          )}
        >
          {available ? (
            <>
            {message.reactions.map((reaction) => {
              const pending = pendingEmojis?.has(reaction.emoji) ?? false;
              const label = messageReactionEmojiLabel(reaction.emoji);

              return (
                <Button
                  key={reaction.emoji}
                  aria-label={`${reaction.reactedByMe ? "Remove" : "Add"} ${label} reaction. ${reaction.count} ${reaction.count === 1 ? "reaction" : "reactions"}.`}
                  aria-pressed={reaction.reactedByMe}
                  className={cn(
                    "min-h-11 min-w-11 rounded-full px-3 text-xs tabular-nums sm:min-h-8 sm:min-w-0 sm:px-2",
                    reaction.reactedByMe
                      ? "border-accent/60 bg-accent/15 text-accent-strong"
                      : "bg-surface/70 text-text",
                  )}
                  disabled={!reactingAllowed || pending}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => toggleReaction(reaction.emoji)}
                >
                  <span aria-hidden="true" className="text-sm">{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </Button>
              );
            })}

            {(reactingAllowed || message.reactions.length > 0 || reportingAllowed) ? (
              <MobileMessageActionTrigger
                mobileActionsButtonRef={mobileActionsButtonRef}
                onOpenMobileActions={() => setMobileActionsOpen(true)}
              />
            ) : null}
            </>
          ) : null}
          <MessageMeta message={message} variant={variant} />
        </div>
        {error ? (
          <p className="mt-1 px-1 text-xs text-rose-ink" role="alert">{error}</p>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {hasPendingReaction ? "Updating reaction" : ""}
        </span>
      </div>

      <MessageReactionPicker
        {...(busyEmoji ? { busyEmoji } : {})}
        {...(error ? { error } : {})}
        onClose={() => setPickerOpen(false)}
        onSelect={(emoji) => {
          toggleReaction(emoji);
          setPickerOpen(false);
        }}
        open={pickerOpen}
        returnFocusRef={pickerReturnFocusRef}
      />
      <MessageReactionDetails
        messageId={message.id}
        onClose={() => setDetailsOpen(false)}
        open={detailsOpen}
        reactionVersion={message.reactionVersion}
        returnFocusRef={detailsReturnFocusRef}
      />
      <MobileMessageActions
        canReact={reactingAllowed}
        canReport={reportingAllowed}
        hasReactions={message.reactions.length > 0}
        message={message}
        onClose={() => setMobileActionsOpen(false)}
        onOpenDetails={openDetailsFromMobileActions}
        onOpenPicker={openPickerFromMobileActions}
        open={mobileActionsOpen}
        returnFocusRef={mobileActionsButtonRef}
      />
    </div>
  );
});

type MessageContentProps = {
  message: ChatMessage;
  mine: boolean;
  variant: ChatMessageBubbleProps["variant"];
};

const MessageContent = memo(function MessageContent({
  message,
  mine,
  variant,
}: MessageContentProps) {
  const display = messageTextForDisplay(message);
  const hasBody = display.body.trim() !== "";
  const hasAttachments = Boolean(message.attachments?.length);

  return (
    <>
      {hasBody ? (
        <div
          className={cn(
            "relative w-fit max-w-[min(31rem,100%)] sm:max-w-[min(36rem,100%)]",
            mine && "ml-auto",
          )}
        >
          {variant === "direct" ? <MessageBubbleTail mine={mine} /> : null}
          <div
            className={cn(
              "relative z-10 rounded-[1.125rem] px-3 py-2 text-sm leading-5 transition duration-fluid ease-fluid",
              mine
                ? "bg-accent text-accent-ink shadow-soft"
                : "bg-surface-strong text-text",
            )}
          >
            <RichText
              text={display.body}
              entities={display.bodyEntities}
              className="block whitespace-pre-wrap break-words"
              embedClassName="mt-2"
            />
          </div>
        </div>
      ) : null}

      {hasAttachments ? (
        <MessageAttachments
          attachments={message.attachments}
          className={cn("mt-1.5", mine && "ml-auto")}
          testId={variant === "room" ? "room-message-attachments" : "chat-message-attachments"}
        />
      ) : null}
    </>
  );
});

function DesktopMessageActionControls({
  addReactionButtonRef,
  canReact,
  canReport,
  detailsButtonRef,
  hasPendingReaction,
  message,
  mine,
  onOpenDetails,
  onOpenPicker,
}: {
  addReactionButtonRef: RefObject<HTMLButtonElement | null>;
  canReact: boolean;
  canReport: boolean;
  detailsButtonRef: RefObject<HTMLButtonElement | null>;
  hasPendingReaction: boolean;
  message: ChatMessage;
  mine: boolean;
  onOpenDetails: () => void;
  onOpenPicker: () => void;
}) {
  return (
    <div
      aria-label="Message actions"
      className={cn(
        "message-actions-desktop pointer-events-none absolute -top-4 z-20 hidden items-center gap-0.5 rounded-full border border-line/80 bg-canvas/95 p-0.5 opacity-0 shadow-soft backdrop-blur-sm transition group-hover/message:pointer-events-auto group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100 motion-reduce:transition-none sm:flex lg:top-0",
        mine
          ? "right-0 lg:right-full lg:mr-1"
          : "left-0 lg:left-full lg:ml-1",
      )}
      role="toolbar"
    >
        {canReact ? (
          <Button
            ref={addReactionButtonRef}
            aria-haspopup="dialog"
            aria-label="Add reaction"
            className="size-8 text-muted"
            disabled={hasPendingReaction}
            icon={<MessageCirclePlus aria-hidden="true" size={15} />}
            size="icon"
            title="Add reaction"
            type="button"
            variant="ghost"
            onClick={onOpenPicker}
          />
        ) : null}
        {message.reactions.length > 0 ? (
          <Button
            ref={detailsButtonRef}
            aria-haspopup="dialog"
            aria-label="See who reacted"
            className="size-8 text-muted"
            icon={<UsersRound aria-hidden="true" size={15} />}
            size="icon"
            title="See reactions"
            type="button"
            variant="ghost"
            onClick={onOpenDetails}
          />
        ) : null}
        {canReport ? (
          <ReportForm
            className="contents"
            feedbackClassName="basis-full"
            reportedUserId={message.sender.id}
            targetId={message.id}
            targetType="message"
            title="Report message"
            triggerClassName="!bg-transparent !text-muted hover:!text-text focus-visible:!text-text"
            triggerIconSize={13}
            triggerLabel="Report message"
            triggerMode="icon"
            triggerSize="compact"
          />
        ) : null}
    </div>
  );
}

function MobileMessageActionTrigger({
  mobileActionsButtonRef,
  onOpenMobileActions,
}: {
  mobileActionsButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenMobileActions: () => void;
}) {
  return (
    <Button
      ref={mobileActionsButtonRef}
      aria-haspopup="dialog"
      aria-label="Message actions"
      className="message-actions-touch size-11 text-muted sm:hidden"
      icon={<MoreHorizontal aria-hidden="true" size={18} />}
      size="icon"
      title="Message actions"
      type="button"
      variant="ghost"
      onClick={onOpenMobileActions}
    />
  );
}

function MobileMessageActions({
  canReact,
  canReport,
  hasReactions,
  message,
  onClose,
  onOpenDetails,
  onOpenPicker,
  open,
  returnFocusRef,
}: {
  canReact: boolean;
  canReport: boolean;
  hasReactions: boolean;
  message: ChatMessage;
  onClose: () => void;
  onOpenDetails: () => void;
  onOpenPicker: () => void;
  open: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  return (
    <ModalSheet
      mobile="sheet"
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      size="sm"
      testId="mobile-message-actions"
      title="Message actions"
    >
      <div className="grid gap-2">
        {canReact ? (
          <Button
            className="min-h-11 justify-start"
            icon={<MessageCirclePlus aria-hidden="true" size={17} />}
            type="button"
            variant="secondary"
            onClick={onOpenPicker}
          >
            Add reaction
          </Button>
        ) : null}
        {hasReactions ? (
          <Button
            className="min-h-11 justify-start"
            icon={<UsersRound aria-hidden="true" size={17} />}
            type="button"
            variant="secondary"
            onClick={onOpenDetails}
          >
            See reactions
          </Button>
        ) : null}
        {canReport ? (
          <ReportForm
            className="[&>button]:min-h-11 [&>button]:w-full [&>button]:justify-start"
            reportedUserId={message.sender.id}
            targetId={message.id}
            targetType="message"
            title="Report message"
            triggerLabel="Report message"
            triggerMode="text"
          />
        ) : null}
      </div>
    </ModalSheet>
  );
}

function MessageMeta({
  message,
  variant,
}: {
  message: ChatMessage;
  variant: ChatMessageBubbleProps["variant"];
}) {
  return (
    <span className="px-1 text-[0.68rem] leading-none text-muted">
      {variant === "room"
        ? formatRelativeActivityTime(message.createdAt)
        : formatMessageTime(message.createdAt)}
    </span>
  );
}

function MessageBubbleTail({ mine }: { mine: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute bottom-1 z-0 h-4 w-6",
        mine ? "-right-2 -scale-x-100" : "-left-2",
      )}
      focusable="false"
      viewBox="0 0 26 16"
    >
      <path
        className={mine ? "fill-accent" : "fill-surface-strong"}
        d="M25.5 0.8H12.8C12.4 6.3 8.5 11.9 1.4 15.2C10.8 15.5 19.2 10.8 25.5 4.2Z"
      />
    </svg>
  );
}

function formatMessageTime(value: string): string {
  const parsed = parseApiTimestamp(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatRelativeActivityTime(value: string): string {
  const parsed = parseApiTimestamp(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const seconds = Math.round((parsed.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);

  if (absoluteSeconds < 60) {
    return "active now";
  }

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const [unit, divisor] =
    units.find(([, unitSeconds]) => absoluteSeconds >= unitSeconds) ?? units.at(-1)!;
  return formatter.format(Math.round(seconds / divisor), unit);
}
