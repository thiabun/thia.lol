import { useEffect, useRef } from "react";
import { cn } from "../../lib/classNames";
import { safeProfileImageUrl } from "../../lib/profileMedia";
import { profileBackgroundTreatment } from "../../lib/profileVisualTreatments";
import type { Profile } from "../../lib/types";

type ProfilePersonalBackdropProps = {
  paused?: boolean | undefined;
  profile: Profile;
};

export function ProfilePersonalBackdrop({
  paused = false,
  profile,
}: ProfilePersonalBackdropProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrl = safeProfileVideoUrl(profile.profileBackgroundVideo);
  const imageUrl = safeProfileImageUrl(
    profile.profileBackgroundVideoPoster ?? profile.profileBackground,
  );
  const blurTreatment = profile.profileBackgroundBlur;
  const treatment = profileBackgroundTreatment(blurTreatment);
  const playbackState = videoUrl ? (paused ? "paused" : "playing") : "static";

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoUrl) {
      return;
    }

    if (paused) {
      video.pause();
      return;
    }

    void video.play().catch(() => undefined);
  }, [paused, videoUrl]);

  return (
    <div
      aria-hidden="true"
      className="profile-personal-backdrop pointer-events-none z-0 min-h-full overflow-hidden"
      data-profile-background-blur={blurTreatment}
      data-profile-background-playback={playbackState}
      data-profile-background-source={videoUrl ? "video" : imageUrl ? "image" : "fallback"}
      data-profile-background-visibility={treatment.name}
      data-testid="profile-personal-backdrop"
    >
      {videoUrl ? (
        <video
          ref={videoRef}
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-full object-cover object-center saturate-[1.04] motion-reduce:hidden",
            treatment.mediaOpacity,
            treatment.blurClass,
          )}
          autoPlay={!paused}
          loop
          muted
          playsInline
          poster={imageUrl}
          preload="metadata"
        >
          <source src={videoUrl} type={videoUrl.endsWith(".webm") ? "video/webm" : "video/mp4"} />
        </video>
      ) : null}
      {imageUrl ? (
        <img
          alt=""
          className={cn(
            "absolute inset-0 size-full object-cover object-center saturate-[1.04]",
            treatment.mediaOpacity,
            videoUrl && !paused ? "motion-safe:hidden" : undefined,
            treatment.blurClass,
          )}
          decoding="async"
          src={imageUrl}
        />
      ) : (
        <div className="absolute inset-0 bg-page-wash" />
      )}
      <div className={cn("absolute inset-0", treatment.baseOverlay)} />
      <div className={cn("absolute inset-0 bg-gradient-to-b", treatment.verticalOverlay)} />
      <div className={cn("absolute inset-0 bg-gradient-to-r via-transparent", treatment.sideVignette)} />
    </div>
  );
}

function safeProfileVideoUrl(value: string | null | undefined): string | undefined {
  return typeof value === "string" &&
    /^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/profile_background-[a-z0-9_-]+\.(?:mp4|webm)$/.test(
      value,
    )
    ? value
    : undefined;
}
