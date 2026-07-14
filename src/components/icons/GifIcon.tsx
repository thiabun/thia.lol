import HeroGifIcon from "@heroicons/react/24/outline/GifIcon";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
} from "react";

type GifIconProps = ComponentPropsWithoutRef<typeof HeroGifIcon> & {
  absoluteStrokeWidth?: boolean;
  size?: number | string;
};

/** Heroicons' literal GIF mark, adapted to the app's Lucide-compatible icon API. */
export const GifIcon = forwardRef<SVGSVGElement, GifIconProps>(
  (
    {
      absoluteStrokeWidth = false,
      height,
      size = 24,
      strokeWidth = 2,
      width,
      ...props
    },
    ref,
  ) => {
    const normalizedStrokeWidth =
      absoluteStrokeWidth && typeof size === "number" && typeof strokeWidth === "number"
        ? (strokeWidth * 24) / size
        : strokeWidth;

    return (
      <HeroGifIcon
        {...props}
        data-icon="gif"
        data-icon-source="heroicons"
        height={height ?? size}
        ref={ref}
        strokeWidth={normalizedStrokeWidth}
        width={width ?? size}
      />
    );
  },
);

GifIcon.displayName = "GifIcon";
