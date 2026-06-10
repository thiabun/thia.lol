export const notificationsUpdatedEventName = "thia:notifications-updated";

export function emitNotificationsUpdated(unreadCount: number) {
  window.dispatchEvent(
    new CustomEvent(notificationsUpdatedEventName, {
      detail: { unreadCount },
    }),
  );
}
