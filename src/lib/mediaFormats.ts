export const acceptedImageUploadTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const acceptedImageUploadExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
] as const;

export const imageUploadAccept = [
  ...acceptedImageUploadTypes,
  ...acceptedImageUploadExtensions,
].join(",");

export const imageUploadFormatHelp =
  "Use JPEG, PNG, WebP, or GIF.";

export const acceptedVideoUploadTypes = [
  "video/mp4",
  "video/webm",
] as const;

export const acceptedVideoUploadExtensions = [
  ".mp4",
  ".webm",
] as const;

export const videoUploadAccept = [
  ...acceptedVideoUploadTypes,
  ...acceptedVideoUploadExtensions,
].join(",");

export const videoUploadFormatHelp =
  "Use MP4 or WebM.";

export function isAcceptedImageUploadFile(file: File): boolean {
  return fileMatchesAcceptedMedia(
    file,
    acceptedImageUploadTypes,
    acceptedImageUploadExtensions,
  );
}

export function isAcceptedVideoUploadFile(file: File): boolean {
  return fileMatchesAcceptedMedia(
    file,
    acceptedVideoUploadTypes,
    acceptedVideoUploadExtensions,
  );
}

function fileMatchesAcceptedMedia(
  file: File,
  acceptedTypes: readonly string[],
  acceptedExtensions: readonly string[],
): boolean {
  const mime = file.type.trim().toLowerCase();
  const name = file.name.trim().toLowerCase();

  return (
    (mime !== "" && acceptedTypes.includes(mime)) ||
    acceptedExtensions.some((extension) => name.endsWith(extension))
  );
}
