import { useTheme } from "../lib/useTheme";

const markSources = {
  frostveil: "/brand/thia-mark-frostveil-96.png",
  sunveil: "/brand/thia-mark-sunveil-96.png",
};

export function BrandLogo() {
  const { theme } = useTheme();

  return (
    <span
      className="inline-flex min-w-0 items-center gap-2"
      data-testid="brand-logo"
    >
      <img
        src={markSources[theme]}
        alt=""
        aria-hidden="true"
        width="32"
        height="32"
        className="size-8 shrink-0 rounded-full object-contain"
      />
      <span className="min-w-0 truncate text-base font-semibold leading-none tracking-normal text-text">
        <span>thia</span>
        <span className="text-rose">.lol</span>
      </span>
    </span>
  );
}
