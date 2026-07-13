import { useState } from "react";
import type { Post, Room } from "../../lib/types";
import { ModalSheet } from "../ui/ModalSheet";
import { UnifiedComposer } from "./UnifiedComposer";

type PostComposerModalProps = {
  csrfToken: string | undefined;
  initialRoomSlug?: string | undefined;
  onClose: () => void;
  onCreated?: (post: Post) => void;
  open: boolean;
  rooms: Room[];
};

export function PostComposerModal(props: PostComposerModalProps) {
  const [busy, setBusy] = useState(false);
  const { initialRoomSlug, onClose, onCreated, open, rooms } = props;

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="New post"
      description="Share something with your profile or a room."
      closeLabel="Close post composer"
      testId="composer-modal"
      size="md"
      mobile="full"
      busy={busy}
      bodyClassName="min-h-0 flex-1 overflow-y-auto p-0 lg:p-0"
    >
      <UnifiedComposer
        autoFocus
        className="min-h-full"
        mode="post"
        initialRoomSlug={initialRoomSlug}
        rooms={rooms}
        onBusyChange={setBusy}
        onCreated={(post) => {
          onCreated?.(post);
          onClose();
        }}
      />
    </ModalSheet>
  );
}
