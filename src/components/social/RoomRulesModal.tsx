import { ScrollText } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { ModalSheet, ModalSheetStatus } from "../ui/ModalSheet";
import type { Room } from "../../lib/types";
import { RichText } from "./RichText";

type RoomRulesAction = "join" | "request" | "view";

type RoomRulesModalProps = {
  action: RoomRulesAction;
  busy?: boolean;
  error?: string | undefined;
  onClose: () => void;
  onConfirm?: () => void;
  open: boolean;
  room: Room;
};

export function RoomRulesModal({
  action,
  busy = false,
  error,
  onClose,
  onConfirm,
  open,
  room,
}: RoomRulesModalProps) {
  const [accepted, setAccepted] = useState(false);
  const requiresAgreement = action !== "view";
  const rules = room.rules?.trim() ?? "";
  const confirmLabel = action === "request" ? "Agree & request access" : "Agree & join";

  return (
    <ModalSheet
      busy={busy}
      closeLabel="Close room rules"
      description={
        requiresAgreement
          ? `Review /${room.slug}'s rules before continuing.`
          : `You can review /${room.slug}'s rules at any time.`
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {requiresAgreement ? "Not now" : "Close"}
          </Button>
          {requiresAgreement ? (
            <Button
              type="button"
              disabled={!accepted || busy}
              onClick={onConfirm}
            >
              {busy ? (action === "request" ? "Requesting" : "Joining") : confirmLabel}
            </Button>
          ) : null}
        </div>
      }
      mobile="sheet"
      onClose={onClose}
      open={open}
      size="sm"
      testId="room-rules-modal"
      title="Room rules"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-card border border-line bg-canvas/45 p-3">
          <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-control border border-line bg-surface-strong text-muted">
            {room.iconUrl ? (
              <img alt="" className="size-full object-cover" src={room.iconUrl} />
            ) : (
              <ScrollText aria-hidden="true" size={18} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{room.name}</p>
            <p className="truncate text-xs text-muted">/{room.slug}</p>
          </div>
        </div>

        <div
          className="max-h-[min(48dvh,24rem)] overflow-y-auto rounded-card border border-line bg-canvas/35 p-4"
          data-testid="room-rules-content"
        >
          {rules ? (
            <RichText
              markdown
              text={rules}
              className="space-y-2 break-words text-sm leading-6 text-text"
            />
          ) : (
            <div className="space-y-2 text-sm leading-6 text-muted">
              <p className="font-medium text-text">No additional room rules.</p>
              <p>Be respectful and follow the thia.lol community policies.</p>
            </div>
          )}
        </div>

        {requiresAgreement ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-card border border-line bg-surface/55 p-3 text-sm text-text transition duration-fluid hover:border-line-strong">
            <input
              className="mt-0.5 size-4 shrink-0 accent-[var(--app-accent)]"
              type="checkbox"
              checked={accepted}
              disabled={busy}
              onChange={(event) => setAccepted(event.currentTarget.checked)}
            />
            <span>I agree to follow these rules</span>
          </label>
        ) : null}

        {error ? <ModalSheetStatus tone="error">{error}</ModalSheetStatus> : null}
      </div>
    </ModalSheet>
  );
}
