import type { Page } from "@playwright/test";

export async function mockSpotifyIframeApi(
  page: Page,
  options: { rejectPlay?: boolean } = {},
) {
  await page.addInitScript(() => {
    Object.assign(window, {
      __spotifyPlayCalls: 0,
    });
  });
  await page.route("https://open.spotify.com/embed/iframe-api/v1", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      status: 200,
      body: `
        window.onSpotifyIframeApiReady({
          createController: function(element, options, callback) {
            window.__spotifyControllerOptions = (window.__spotifyControllerOptions || []).concat(options);
            var listeners = {};
            var currentPosition = 60000;
            var duration = 180000;
            function addListener(event, listener) {
              listeners[event] = listeners[event] || [];
              listeners[event].push(listener);
            }
            function removeListener(event, listener) {
              listeners[event] = (listeners[event] || []).filter(function(item) {
                return item !== listener;
              });
            }
            function emitProgress(isPaused) {
              (listeners.playback_update || []).forEach(function(listener) {
                listener({
                  data: {
                    duration: duration,
                    isBuffering: false,
                    isPaused: isPaused,
                    playingURI: options.uri,
                    position: currentPosition
                  }
                });
              });
            }
            var parts = String(options.uri || "").split(":");
            var iframe = document.createElement("iframe");
            iframe.src = "https://open.spotify.com/embed/" + parts[1] + "/" + parts[2] + "?theme=0";
            iframe.height = options.height;
            element.appendChild(iframe);
            callback({
              addListener: addListener,
              destroy: function() {},
              pause: function() {
                emitProgress(true);
                return Promise.resolve();
              },
              play: function() {
                window.__spotifyPlayCalls = (window.__spotifyPlayCalls || 0) + 1;
                ${
                  options.rejectPlay
                    ? "return Promise.reject(new Error('blocked'));"
                    : "emitProgress(false); return Promise.resolve();"
                }
              },
              removeListener: removeListener,
              togglePlay: function() {
                window.__spotifyPlayCalls = (window.__spotifyPlayCalls || 0) + 1;
                emitProgress(false);
                return Promise.resolve();
              }
            });
          }
        });
      `,
    });
  });
}

export function spotifyPlayCalls(page: Page): Promise<number> {
  return page.evaluate(() => {
    const testWindow = window as Window & { __spotifyPlayCalls?: number };

    return Number(testWindow.__spotifyPlayCalls ?? 0);
  });
}
