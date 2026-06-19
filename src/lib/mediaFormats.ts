export const acceptedImageUploadTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/jxl",
] as const;

export const acceptedImageUploadExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".jxl",
] as const;

export const imageUploadAccept = [
  ...acceptedImageUploadTypes,
  ...acceptedImageUploadExtensions,
].join(",");

export const imageUploadFormatHelp =
  "Use JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC, HEIF, TIFF, or JPEG XL.";

export const acceptedVideoUploadTypes = [
  "video/mp4",
  "video/x-m4v",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
  "video/ogg",
  "application/ogg",
  "video/3gpp",
  "video/3gpp2",
  "video/mpeg",
] as const;

export const acceptedVideoUploadExtensions = [
  ".mp4",
  ".m4v",
  ".mov",
  ".qt",
  ".webm",
  ".mkv",
  ".avi",
  ".ogv",
  ".ogg",
  ".3gp",
  ".3g2",
] as const;

export const videoUploadAccept = [
  ...acceptedVideoUploadTypes,
  ...acceptedVideoUploadExtensions,
].join(",");

export const videoUploadFormatHelp =
  "Use MP4, MOV/QuickTime, WebM, M4V, MKV, AVI, OGG/OGV, or 3GP. Videos are converted to MP4.";

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
