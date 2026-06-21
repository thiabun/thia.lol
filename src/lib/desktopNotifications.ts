import type { PushSubscriptionInput } from "./api";

export type DesktopNotificationBrowserSupport = {
  supported: boolean;
  serviceWorker: boolean;
  notification: boolean;
  pushManager: boolean;
  permission: NotificationPermission | "unsupported";
};

export function desktopNotificationSupport(): DesktopNotificationBrowserSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supported: false,
      serviceWorker: false,
      notification: false,
      pushManager: false,
      permission: "unsupported",
    };
  }

  const serviceWorker = "serviceWorker" in navigator;
  const notification = "Notification" in window;
  const pushManager = "PushManager" in window;

  return {
    supported: serviceWorker && notification && pushManager,
    serviceWorker,
    notification,
    pushManager,
    permission: notification ? Notification.permission : "unsupported",
  };
}

export async function ensureNotificationServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }

  return navigator.serviceWorker.register("/service-worker.js");
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await ensureNotificationServiceWorkerRegistration();

  return registration.pushManager.getSubscription();
}

export async function subscribeToDesktopNotifications(
  publicKey: string,
): Promise<PushSubscriptionInput> {
  const support = desktopNotificationSupport();

  if (!support.supported) {
    throw new Error("This browser does not support desktop notifications.");
  }

  let permission = Notification.permission;

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    throw new Error("Desktop notification permission is blocked in this browser.");
  }

  const registration = await ensureNotificationServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    }));

  return pushSubscriptionToInput(subscription);
}

export async function unsubscribeFromDesktopNotifications(): Promise<string | undefined> {
  const subscription = await currentPushSubscription();

  if (!subscription) {
    return undefined;
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  return endpoint;
}

export function pushSubscriptionToInput(
  subscription: PushSubscription,
): PushSubscriptionInput {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!p256dh || !auth) {
    throw new Error("Browser push subscription keys are missing.");
  }

  return {
    endpoint: subscription.endpoint,
    keys: { p256dh, auth },
    userAgent: navigator.userAgent,
  };
}

function base64UrlToUint8Array(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let index = 0; index < raw.length; index++) {
    output[index] = raw.charCodeAt(index);
  }

  return output.buffer;
}
