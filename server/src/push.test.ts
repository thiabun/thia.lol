import { describe, expect, it } from "vitest";

import { createPushRepository } from "./push.js";

function fakePool() {
  return {
    async execute(query: string) {
      if (query.includes("information_schema.TABLES")) {
        return [[{ value: 1 }], undefined];
      }

      if (query.includes("FROM push_subscriptions")) {
        return [[], undefined];
      }

      throw new Error(`Unhandled fake pool query: ${query}`);
    },
  };
}

describe("push notification status", () => {
  it("reports Node subscription prerequisites as available when configured", async () => {
    const repository = createPushRepository(fakePool() as never, {
      publicKey: "public-key",
      privateKey: "private-key",
      subject: "mailto:hello@thia.lol",
    });
    const status = await repository.status(1);

    expect(status.configured).toBe(true);
    expect(status.storageReady).toBe(true);
    expect(status.publicKey).toBe("public-key");
    expect(status.diagnostics).toEqual({
      missingConfigKeys: [],
      curlAvailable: true,
      opensslAvailable: true,
    });
  });
});
