import { MessageCircle, Repeat2, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { AmbientImage } from "../ui/AmbientImage";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Panel } from "../ui/Panel";
import type { Post } from "../../lib/types";

type PostCardProps = {
  post: Post;
  index?: number;
};

export function PostCard({ post, index = 0 }: PostCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 210, damping: 26, delay: index * 0.04 }}
    >
      <Panel interactive className="overflow-hidden p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Avatar user={post.author} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-sm font-semibold text-text">
                {post.author.displayName}
              </h2>
              <span className="text-sm text-muted">@{post.author.handle}</span>
              <span className="text-muted/50">·</span>
              <span className="text-sm text-muted">{post.createdAt}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={post.mood === "frostveil" ? "cool" : "warm"}>
                {post.room.name}
              </Badge>
              <Badge>{post.mood}</Badge>
            </div>
          </div>
        </div>

        <p className="mt-4 text-pretty text-base leading-7 text-text">{post.body}</p>

        {post.mediaUrl ? (
          <div className="mt-4 overflow-hidden rounded-card border border-line bg-canvas">
            {post.mediaUrl === "/ambient-veil.webp" ? (
              <AmbientImage className="aspect-[16/9] w-full" />
            ) : (
              <img
                src={post.mediaUrl}
                alt=""
                className="aspect-[16/9] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Reaction icon={Sparkles} label="Glow" count={post.reactions.glow} />
          <Reaction icon={Repeat2} label="Echo" count={post.reactions.echo} />
          <Reaction icon={MessageCircle} label="Hush" count={post.reactions.hush} />
        </div>
      </Panel>
    </motion.article>
  );
}

type ReactionProps = {
  icon: typeof Sparkles;
  label: string;
  count: number;
};

function Reaction({ icon: Icon, label, count }: ReactionProps) {
  return (
    <button
      type="button"
      className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 transition duration-fluid ease-fluid hover:bg-surface-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      aria-label={`${count} ${label}`}
      title={label}
    >
      <Icon aria-hidden="true" size={15} />
      <span>{count}</span>
    </button>
  );
}
