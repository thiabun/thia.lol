/* global self, URL */

self.addEventListener("push", (event) => {
  let payload = {
    title: "thia.lol",
    body: "Open thia.lol to view this notification.",
    url: "/notifications",
    tag: "thia-notification",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const targetUrl =
    typeof payload.url === "string" && payload.url.startsWith("/")
      ? payload.url
      : "/notifications";

  event.waitUntil(
    self.registration.showNotification(payload.title || "thia.lol", {
      body: payload.body || "Open thia.lol to view this notification.",
      icon: "/brand/thia-app-icon-192.png",
      badge: "/favicon-32x32.png",
      tag: payload.tag || "thia-notification",
      data: { url: targetUrl },
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/notifications";
  const absoluteUrl = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client && client.url.startsWith(self.location.origin)) {
            return client.focus().then(() => {
              if ("navigate" in client) {
                return client.navigate(absoluteUrl);
              }

              return undefined;
            });
          }
        }

        return self.clients.openWindow(absoluteUrl);
      }),
  );
});
