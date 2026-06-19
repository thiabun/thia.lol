import {
  acceptedImageUploadTypes,
  imageUploadFormatHelp,
  isAcceptedImageUploadFile,
} from "./mediaFormats";

export const imageCropMaxUploadBytes = 10 * 1024 * 1024;

export const acceptedImageCropTypes = [...acceptedImageUploadTypes];

export function validateImageCropFile(file: File): string | undefined {
  if (file.size > imageCropMaxUploadBytes) {
    return "Image must be 10 MB or smaller.";
  }

  if (!isAcceptedImageUploadFile(file)) {
    return `Unsupported image type. ${imageUploadFormatHelp}`;
  }

  return undefined;
}
