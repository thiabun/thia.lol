import { MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { PageMeta } from "../components/PageMeta";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";

export function ChatPage() {
  return (
    <motion.div
      className="mx-auto max-w-3xl"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Chat"
        description="Chat is coming soon on thia.lol."
        path="/chat"
      />
      <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
        <Panel className="p-5 sm:p-6">
          <Badge tone="cool">chat</Badge>
          <div className="mt-5 flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-card bg-surface-strong text-accent-strong">
              <MessageCircle aria-hidden="true" size={22} />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-text">
                Chat is coming soon
              </h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-muted">
                Direct messages are not available yet.
              </p>
            </div>
          </div>
        </Panel>
      </motion.div>
    </motion.div>
  );
}
