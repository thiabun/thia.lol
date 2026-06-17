export const imageCropMaxUploadBytes = 10 * 1024 * 1024;

export const acceptedImageCropTypes = ["image/jpeg", "image/png", "image/webp"];

export function validateImageCropFile(file: File): string | undefined {
  if (file.size > imageCropMaxUploadBytes) {
    return "Image must be 10 MB or smaller.";
  }

  if (!acceptedImageCropTypes.includes(file.type)) {
    return "Unsupported image type. Use JPEG, PNG, or WebP.";
  }

  return undefined;
}
