import {
  acceptedImageUploadTypes,
  imageUploadFormatHelp,
  isAcceptedImageUploadFile,
  requiresImageUploadPreviewConversion,
} from "./mediaFormats";
import type { ImageUploadPurpose } from "./api";

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

export async function prepareImageFileForCrop(
  file: File,
  purpose: ImageUploadPurpose,
  convert: (file: File, purpose: ImageUploadPurpose) => Promise<File>,
): Promise<File> {
  const validationError = validateImageCropFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  return requiresImageUploadPreviewConversion(file) ? convert(file, purpose) : file;
}
