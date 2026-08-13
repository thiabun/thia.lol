import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Button } from "../ui/Button";
import { ModalSheet, ModalSheetStatus } from "../ui/ModalSheet";
import {
  normalizeMessageReactionEmoji,
  quickMessageReactionEmoji,
} from "./messageReactionEmoji";

export type MessageReactionPickerProps = {
  busyEmoji?: string;
  error?: string;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function MessageReactionPicker({
  busyEmoji,
  error,
  onClose,
  onSelect,
  open,
  returnFocusRef,
}: MessageReactionPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const firstQuickReactionRef = useRef<HTMLButtonElement>(null);
  const [customEmoji, setCustomEmoji] = useState("");
  const [validationError, setValidationError] = useState<string>();

  function handleCustomEmojiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emoji = normalizeMessageReactionEmoji(customEmoji);

    if (!emoji) {
      setValidationError("Enter one emoji.");
      inputRef.current?.focus();
      return;
    }

    setValidationError(undefined);
    onSelect(emoji);
  }

  const busy = busyEmoji !== undefined;
  const close = () => {
    setCustomEmoji("");
    setValidationError(undefined);
    onClose();
  };

  return (
    <ModalSheet
      busy={busy}
      description="Choose a quick reaction or enter another emoji."
      initialFocusRef={firstQuickReactionRef}
      mobile="sheet"
      onClose={close}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      size="sm"
      testId="message-reaction-picker"
      title="React to message"
    >
      <div className="space-y-5">
        <div
          aria-label="Quick reactions"
          className="grid grid-cols-3 gap-2 min-[360px]:grid-cols-6"
          role="group"
        >
          {quickMessageReactionEmoji.map((option, index) => {
            const pending = busyEmoji === option.emoji;

            return (
              <Button
                key={option.emoji}
                ref={index === 0 ? firstQuickReactionRef : undefined}
                aria-label={`React with ${option.label}`}
                className="size-11 text-xl"
                disabled={busy}
                icon={<span aria-hidden="true">{option.emoji}</span>}
                size="icon"
                title={`React with ${option.label}`}
                type="button"
                variant="secondary"
                onClick={() => onSelect(option.emoji)}
              >
                <span className="sr-only">{pending ? "Updating" : option.label}</span>
              </Button>
            );
          })}
        </div>

        <form className="space-y-2" onSubmit={handleCustomEmojiSubmit}>
          <label className="block text-sm font-semibold text-text" htmlFor={inputId}>
            Another emoji
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              id={inputId}
              aria-describedby={`${inputId}-hint`}
              aria-invalid={validationError ? true : undefined}
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 rounded-control border border-line bg-canvas px-3 text-base text-text outline-none transition focus:border-line-strong focus:ring-2 focus:ring-focus/30"
              disabled={busy}
              inputMode="text"
              maxLength={64}
              placeholder="Paste one emoji"
              value={customEmoji}
              onChange={(event) => {
                setCustomEmoji(event.target.value);
                setValidationError(undefined);
              }}
            />
            <Button disabled={busy || customEmoji.trim() === ""} type="submit">
              {busyEmoji === normalizeMessageReactionEmoji(customEmoji)
                ? "Adding"
                : "Add"}
            </Button>
          </div>
          <p id={`${inputId}-hint`} className="text-xs leading-5 text-muted">
            Use one emoji, including a combined skin tone or family emoji.
          </p>
        </form>

        {validationError ? (
          <ModalSheetStatus tone="error">{validationError}</ModalSheetStatus>
        ) : null}
        {error ? <ModalSheetStatus tone="error">{error}</ModalSheetStatus> : null}
        <span className="sr-only" aria-live="polite">
          {busyEmoji ? `Updating ${busyEmoji} reaction` : ""}
        </span>
      </div>
    </ModalSheet>
  );
}
