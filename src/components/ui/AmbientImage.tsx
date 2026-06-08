import type { ImgHTMLAttributes } from "react";
import { cn } from "../../lib/classNames";

type AmbientImageProps = {
  className?: string;
  imageClassName?: string;
  overlay?: boolean;
  loading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
  priority?: boolean;
};

export function AmbientImage({
  className,
  imageClassName,
  overlay = false,
  loading = "lazy",
  priority = false,
}: AmbientImageProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src="/ambient-veil.webp"
        alt=""
        width="1280"
        height="721"
        loading={loading}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn("size-full object-cover", imageClassName)}
      />
      {overlay ? <div className="absolute inset-0 bg-media-scrim" /> : null}
    </div>
  );
}
