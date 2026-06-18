import {
  ImagePlus,
  Move,
  RotateCcw,
  Scissors,
  ZoomIn,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ImageUploadPurpose } from "../../lib/api";
import { cn } from "../../lib/classNames";
import { Button } from "./Button";
import { ModalSheet, ModalSheetStatus } from "./ModalSheet";

type ImageCropModalProps = {
  busy?: boolean;
  file?: File | undefined;
  onApply: (file: File) => Promise<void> | void;
  onClose: () => void;
  open: boolean;
  purpose: ImageUploadPurpose;
};

type LoadedImage = {
  fileToken: string;
  height: number;
  url: string;
  width: number;
};

type DragState = {
  offsetX: number;
  offsetY: number;
  pointerId: number;
  x: number;
  y: number;
};

type CropAspectOption = {
  aspect: number;
  id: string;
  label: string;
};

type FrameMetrics = {
  baseScale: number;
  frameHeight: number;
  frameWidth: number;
};

const fixedCropAspects: Partial<Record<ImageUploadPurpose, CropAspectOption>> = {
  avatar: { aspect: 1, id: "square", label: "Square" },
  banner: { aspect: 8 / 3, id: "wide", label: "Wide" },
  profile_background: { aspect: 16 / 9, id: "landscape", label: "Landscape" },
  room_icon: { aspect: 1, id: "square", label: "Square" },
  room_banner: { aspect: 8 / 3, id: "wide", label: "Wide" },
};

const cropTitles: Record<ImageUploadPurpose, string> = {
  avatar: "Crop avatar",
  banner: "Crop banner",
  profile_background: "Crop background",
  post_media: "Crop image",
  room_icon: "Crop room icon",
  room_banner: "Crop room banner",
};

export function ImageCropModal({
  busy = false,
  file,
  onApply,
  onClose,
  open,
  purpose,
}: ImageCropModalProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | undefined>(undefined);
  const [loadedImage, setLoadedImage] = useState<LoadedImage | undefined>();
  const [frameSize, setFrameSize] = useState<
    { height: number; width: number } | undefined
  >();
  const [aspectId, setAspectId] = useState("original");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const fixedAspect = fixedCropAspects[purpose];
  const fileToken = file
    ? `${file.name}:${file.size}:${file.lastModified}:${purpose}`
    : "";
  const activeImage =
    loadedImage?.fileToken === fileToken ? loadedImage : undefined;
  const aspectOptions = useMemo(
    () => cropAspectOptions(purpose, activeImage),
    [activeImage, purpose],
  );
  const selectedAspect =
    fixedAspect?.aspect ??
    aspectOptions.find((option) => option.id === aspectId)?.aspect ??
    1;
  const disabled = busy || processing;
  const previewMetrics =
    activeImage && frameSize
      ? frameMetricsFromDimensions(frameSize.width, frameSize.height, activeImage)
      : undefined;
  const previewImageStyle =
    activeImage && previewMetrics
      ? {
          height: `${activeImage.height * previewMetrics.baseScale * zoom}px`,
          left: `calc(50% + ${offset.x}px)`,
          top: `calc(50% + ${offset.y}px)`,
          transform: "translate(-50%, -50%)",
          width: `${activeImage.width * previewMetrics.baseScale * zoom}px`,
        }
      : undefined;

  useEffect(() => {
    if (!open || !file) {
      return undefined;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      setAspectId("original");
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setError(undefined);
      setLoadedImage({
        fileToken,
        height: image.naturalHeight,
        url,
        width: image.naturalWidth,
      });
    };
    image.onerror = () => {
      setError("This image could not be read.");
    };
    image.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, fileToken, open]);

  useEffect(() => {
    if (!open || !frameRef.current) {
      return undefined;
    }

    const frame = frameRef.current;
    const updateFrameSize = () => {
      const rect = frame.getBoundingClientRect();

      setFrameSize({
        height: Math.max(1, rect.height),
        width: Math.max(1, rect.width),
      });
    };

    updateFrameSize();

    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(frame);
    window.addEventListener("resize", updateFrameSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateFrameSize);
    };
  }, [open, selectedAspect]);

  useEffect(() => {
    if (!activeImage || !frameRef.current) {
      return;
    }

    setOffset((current) =>
      clampOffset(current, frameRef.current, activeImage, selectedAspect, zoom),
    );
  }, [activeImage, frameSize, selectedAspect, zoom]);

  function resetCrop() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError(undefined);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || !activeImage) {
      return;
    }

    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some synthetic test events do not create an active pointer capture target.
    }
    dragRef.current = {
      offsetX: offset.x,
      offsetY: offset.y,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId || !activeImage) {
      return;
    }

    const nextOffset = {
      x: drag.offsetX + event.clientX - drag.x,
      y: drag.offsetY + event.clientY - drag.y,
    };
    setOffset(clampOffset(nextOffset, frameRef.current, activeImage, selectedAspect, zoom));
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = undefined;
    }
  }

  async function handleApply() {
    if (!file || !activeImage || !frameRef.current) {
      setError("Choose an image before applying a crop.");
      return;
    }

    setProcessing(true);
    setError(undefined);

    try {
      const croppedFile = await cropImageFile({
        aspect: selectedAspect,
        file,
        frame: frameRef.current,
        image: activeImage,
        offset,
        purpose,
        zoom,
      });
      await onApply(croppedFile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Image could not be cropped.");
      setProcessing(false);
      return;
    }

    setProcessing(false);
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={cropTitles[purpose]}
      closeLabel="Close image crop"
      testId="image-crop-modal"
      size="xl"
      mobile="full"
      busy={disabled}
      bodyClassName="grid gap-4"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={disabled} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={disabled || !activeImage}
            icon={<Scissors aria-hidden="true" size={16} />}
            onClick={() => void handleApply()}
          >
            {processing || busy ? "Applying" : "Apply crop"}
          </Button>
        </div>
      }
    >
      {fixedAspect ? (
        <div className="flex items-center gap-2 rounded-card border border-line bg-canvas/55 px-3 py-2 text-sm text-muted">
          <ImagePlus aria-hidden="true" size={16} />
          <span>{fixedAspect.label} crop</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" aria-label="Crop shape">
          {aspectOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className="rounded-control border border-line bg-canvas/55 px-3 py-2 text-sm font-semibold text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-surface aria-pressed:text-text"
              aria-pressed={aspectId === option.id}
              disabled={disabled}
              data-testid={`image-crop-aspect-${option.id}`}
              onClick={() => {
                setAspectId(option.id);
                setOffset({ x: 0, y: 0 });
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div
        ref={frameRef}
        className={cn(
          "relative mx-auto w-full touch-none overflow-hidden rounded-panel border border-line bg-canvas/70 shadow-inner-soft",
          disabled ? "cursor-wait" : "cursor-grab active:cursor-grabbing",
        )}
        style={{
          aspectRatio: selectedAspect,
          maxWidth: cropFrameMaxWidth(purpose, selectedAspect),
        }}
        data-testid="image-crop-frame"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {activeImage ? (
          <img
            alt=""
            aria-hidden="true"
            className="absolute max-w-none select-none"
            draggable={false}
            src={activeImage.url}
            style={previewImageStyle}
            data-testid="image-crop-preview"
          />
        ) : (
          <div className="grid size-full min-h-64 place-items-center text-sm text-muted">
            Loading image
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 border border-white/55 shadow-[inset_0_0_0_9999px_rgb(0_0_0/0.08)]" />
      </div>

      <div className="grid gap-3 rounded-card border border-line bg-canvas/45 p-3">
        <label className="grid gap-2 text-sm font-semibold text-text">
          <span className="inline-flex items-center gap-2">
            <ZoomIn aria-hidden="true" size={16} />
            Zoom
          </span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            disabled={disabled || !activeImage}
            data-testid="image-crop-zoom"
            onChange={(event) => {
              const nextZoom = Number(event.currentTarget.value);
              setZoom(nextZoom);

              if (activeImage) {
                setOffset((current) =>
                  clampOffset(
                    current,
                    frameRef.current,
                    activeImage,
                    selectedAspect,
                    nextZoom,
                  ),
                );
              }
            }}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-xs leading-5 text-muted">
            <Move aria-hidden="true" size={15} />
            Drag the image to choose what stays visible.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !activeImage}
            icon={<RotateCcw aria-hidden="true" size={15} />}
            onClick={resetCrop}
          >
            Reset
          </Button>
        </div>
      </div>

      {error ? <ModalSheetStatus tone="error">{error}</ModalSheetStatus> : null}
    </ModalSheet>
  );
}

function cropAspectOptions(
  purpose: ImageUploadPurpose,
  image: LoadedImage | undefined,
): CropAspectOption[] {
  if (purpose !== "post_media") {
    const fixed = fixedCropAspects[purpose];
    return fixed ? [fixed] : [];
  }

  const originalAspect =
    image && image.width > 0 && image.height > 0 ? image.width / image.height : 1;

  return [
    { aspect: originalAspect, id: "original", label: "Original" },
    { aspect: 1, id: "square", label: "Square" },
    { aspect: 4 / 5, id: "portrait", label: "Portrait" },
    { aspect: 16 / 9, id: "landscape", label: "Landscape" },
  ];
}

function frameMetrics(
  frame: HTMLDivElement,
  image: LoadedImage,
  aspect: number,
): FrameMetrics {
  const rect = frame.getBoundingClientRect();
  const frameWidth = Math.max(1, rect.width);
  const frameHeight = Math.max(1, rect.height || frameWidth / aspect);

  return frameMetricsFromDimensions(frameWidth, frameHeight, image);
}

function frameMetricsFromDimensions(
  frameWidth: number,
  frameHeight: number,
  image: LoadedImage,
): FrameMetrics {
  const baseScale = Math.max(frameWidth / image.width, frameHeight / image.height);

  return { baseScale, frameHeight, frameWidth };
}

function cropFrameMaxWidth(
  purpose: ImageUploadPurpose,
  aspect: number,
): string {
  if (purpose === "avatar" || purpose === "room_icon") {
    return "280px";
  }

  if (purpose === "banner" || purpose === "room_banner" || purpose === "profile_background") {
    return "560px";
  }

  return aspect < 1 ? "360px" : "480px";
}

function clampOffset(
  offset: { x: number; y: number },
  frame: HTMLDivElement | null,
  image: LoadedImage,
  aspect: number,
  zoom: number,
): { x: number; y: number } {
  if (!frame) {
    return offset;
  }

  const metrics = frameMetrics(frame, image, aspect);
  const renderedWidth = image.width * metrics.baseScale * zoom;
  const renderedHeight = image.height * metrics.baseScale * zoom;
  const maxX = Math.max(0, (renderedWidth - metrics.frameWidth) / 2);
  const maxY = Math.max(0, (renderedHeight - metrics.frameHeight) / 2);

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

async function cropImageFile({
  aspect,
  file,
  frame,
  image,
  offset,
  purpose,
  zoom,
}: {
  aspect: number;
  file: File;
  frame: HTMLDivElement;
  image: LoadedImage;
  offset: { x: number; y: number };
  purpose: ImageUploadPurpose;
  zoom: number;
}): Promise<File> {
  const source = await loadImageElement(image.url);
  const metrics = frameMetrics(frame, image, aspect);
  const scale = metrics.baseScale * zoom;
  const renderedWidth = image.width * scale;
  const renderedHeight = image.height * scale;
  const left = (metrics.frameWidth - renderedWidth) / 2 + offset.x;
  const top = (metrics.frameHeight - renderedHeight) / 2 + offset.y;
  const sourceX = clamp(-left / scale, 0, image.width);
  const sourceY = clamp(-top / scale, 0, image.height);
  const sourceWidth = clamp(metrics.frameWidth / scale, 1, image.width - sourceX);
  const sourceHeight = clamp(metrics.frameHeight / scale, 1, image.height - sourceY);
  const output = cropOutputSize(purpose, aspect);
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image could not be cropped.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    output.width,
    output.height,
  );

  const blob =
    (await canvasToBlob(canvas, "image/webp", 0.92)) ??
    (await canvasToBlob(canvas, "image/jpeg", 0.92));

  if (!blob) {
    throw new Error("Image could not be exported.");
  }

  const extension = blob.type === "image/jpeg" ? "jpg" : "webp";
  const originalName = file.name.replace(/\.[^.]+$/, "") || "image";

  return new File([blob], `${originalName}-crop.${extension}`, {
    lastModified: Date.now(),
    type: blob.type,
  });
}

function cropOutputSize(
  purpose: ImageUploadPurpose,
  aspect: number,
): { height: number; width: number } {
  if (purpose === "avatar" || purpose === "room_icon") {
    return { height: 512, width: 512 };
  }

  if (purpose === "banner" || purpose === "room_banner") {
    return { height: 600, width: 1600 };
  }

  if (purpose === "profile_background") {
    return { height: 1080, width: 1920 };
  }

  return containAspectWithin(aspect, 1920, 1920);
}

function containAspectWithin(
  aspect: number,
  maxWidth: number,
  maxHeight: number,
): { height: number; width: number } {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  let width = maxWidth;
  let height = Math.round(width / safeAspect);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * safeAspect);
  }

  return {
    height: Math.max(1, height),
    width: Math.max(1, width),
  };
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be read."));
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
