export const acceptedImageUploadTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/bmp",
] as const;

export const acceptedImageUploadExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".bmp",
] as const;

export const imageUploadAccept = [
  ...acceptedImageUploadTypes,
  ...acceptedImageUploadExtensions,
].join(",");

export const imageUploadFormatHelp =
  "Use JPEG, PNG, WebP, GIF, AVIF, HEIC/HEIF, TIFF, or BMP.";

export const acceptedVideoUploadTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/3gpp",
  "video/3gpp2",
  "video/matroska",
  "video/vnd.avi",
  "video/mpeg",
  "video/ogg",
] as const;

export const acceptedVideoUploadExtensions = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".3gp",
  ".3g2",
  ".mkv",
  ".avi",
  ".mpeg",
  ".mpg",
  ".ogv",
  ".ogg",
] as const;

export const videoUploadAccept = [
  ...acceptedVideoUploadTypes,
  ...acceptedVideoUploadExtensions,
].join(",");

export const videoUploadFormatHelp =
  "Use MP4, WebM, MOV, M4V, 3GP, MKV, AVI, MPEG, or OGG.";

export const visualMediaUploadAccept = [
  ...acceptedImageUploadTypes,
  ...acceptedImageUploadExtensions,
  ...acceptedVideoUploadTypes,
  ...acceptedVideoUploadExtensions,
].join(",");

export const acceptedAudioUploadTypes = [
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/x-flac",
  "audio/x-m4a",
  "audio/x-wav",
] as const;

export const acceptedAudioUploadExtensions = [
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".oga",
  ".ogg",
  ".wav",
] as const;

export const audioUploadAccept = [
  ...acceptedAudioUploadTypes,
  ...acceptedAudioUploadExtensions,
].join(",");

export const audioUploadFormatHelp = "Use MP3, M4A, AAC, WAV, FLAC, or OGG.";

export const mediaUploadAccept = [
  ...acceptedImageUploadTypes,
  ...acceptedImageUploadExtensions,
  ...acceptedVideoUploadTypes,
  ...acceptedVideoUploadExtensions,
  ...acceptedAudioUploadTypes,
  ...acceptedAudioUploadExtensions,
].join(",");

export const mediaUploadFormatHelp = `${imageUploadFormatHelp} ${videoUploadFormatHelp} ${audioUploadFormatHelp}`;

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

export function isAcceptedAudioUploadFile(file: File): boolean {
  return fileMatchesAcceptedMedia(
    file,
    acceptedAudioUploadTypes,
    acceptedAudioUploadExtensions,
  );
}

export function isAcceptedMediaUploadFile(file: File): boolean {
  return isAcceptedImageUploadFile(file) || isAcceptedVideoUploadFile(file) || isAcceptedAudioUploadFile(file);
}

export function isLikelyVideoUploadFile(file: File): boolean {
  return fileMatchesAcceptedMedia(
    file,
    acceptedVideoUploadTypes,
    acceptedVideoUploadExtensions,
  );
}

export function isLikelyAudioUploadFile(file: File): boolean {
  return fileMatchesAcceptedMedia(
    file,
    acceptedAudioUploadTypes,
    acceptedAudioUploadExtensions,
  );
}

export function requiresImageUploadPreviewConversion(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  const name = file.name.trim().toLowerCase();
  const conversionOnlyTypes = new Set([
    "image/heic",
    "image/heif",
    "image/tiff",
    "image/bmp",
  ]);
  const conversionOnlyExtensions = [".heic", ".heif", ".tif", ".tiff", ".bmp"];

  return (
    conversionOnlyTypes.has(mime) ||
    conversionOnlyExtensions.some((extension) => name.endsWith(extension))
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
