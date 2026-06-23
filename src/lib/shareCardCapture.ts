import { toBlob } from "html-to-image";

const SHARE_CARD_WIDTH = 1200;
const SHARE_CARD_HEIGHT = 630;
const SHARE_CARD_PIXEL_RATIO = 2;
const SHARE_CARD_READY_TIMEOUT_MS = 12000;

type CaptureShareCardOptions = {
  pixelRatio?: number;
  quality?: number;
  type?: "image/jpeg" | "image/png";
};

export async function captureShareCard(
  path: string,
  options: CaptureShareCardOptions = {},
): Promise<Blob> {
  const pixelRatio = options.pixelRatio ?? SHARE_CARD_PIXEL_RATIO;
  const type = options.type ?? "image/png";
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.width = String(SHARE_CARD_WIDTH);
  iframe.height = String(SHARE_CARD_HEIGHT);
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${SHARE_CARD_WIDTH}px`;
  iframe.style.height = `${SHARE_CARD_HEIGHT}px`;
  iframe.style.border = "0";
  iframe.style.pointerEvents = "none";
  document.body.append(iframe);

  try {
    await loadIframe(iframe, path);
    const documentElement = iframe.contentDocument;

    if (!documentElement) {
      throw new Error("Share card renderer did not load.");
    }

    const canvas = await waitForShareCardCanvas(documentElement);
    await documentElement.fonts?.ready.catch(() => undefined);
    await waitForImages(documentElement);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const captureOptions = {
      backgroundColor: "transparent",
      cacheBust: true,
      includeQueryParams: true,
      pixelRatio,
      type,
      width: SHARE_CARD_WIDTH,
      height: SHARE_CARD_HEIGHT,
      canvasWidth: SHARE_CARD_WIDTH * pixelRatio,
      canvasHeight: SHARE_CARD_HEIGHT * pixelRatio,
      style: {
        width: `${SHARE_CARD_WIDTH}px`,
        height: `${SHARE_CARD_HEIGHT}px`,
        transform: "none",
      },
      ...(options.quality !== undefined ? { quality: options.quality } : {}),
    };

    const blob = await toBlob(canvas, captureOptions);

    if (!blob) {
      throw new Error("Share card image could not be generated.");
    }

    return blob;
  } finally {
    iframe.remove();
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadIframe(iframe: HTMLIFrameElement, path: string) {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Share card renderer timed out."));
    }, SHARE_CARD_READY_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeout);
      iframe.removeEventListener("load", onLoad);
      iframe.removeEventListener("error", onError);
    };

    const onLoad = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Share card renderer failed to load."));
    };

    iframe.addEventListener("load", onLoad);
    iframe.addEventListener("error", onError);
    iframe.src = path;
  });
}

async function waitForShareCardCanvas(documentElement: Document): Promise<HTMLElement> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SHARE_CARD_READY_TIMEOUT_MS) {
    const canvas = documentElement.querySelector<HTMLElement>(
      "[data-share-card-canvas][data-share-card-ready='true']",
    );

    if (canvas) {
      return canvas;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 80));
  }

  throw new Error("Share card renderer was not ready.");
}

async function waitForImages(documentElement: Document) {
  const images = Array.from(documentElement.images);
  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) {
        return;
      }

      await image.decode().catch(() => undefined);
    }),
  );
}
