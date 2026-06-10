import { expect, type Page, test } from "@playwright/test";
import { loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type FollowRelationship = {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  followerCount: number;
  followingCount: number;
};

type ProfileResponse = {
  user: {
    handle: string;
  };
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

test.describe("follow graph smoke", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("follow and unfollow update profile relationship state", async ({ page }) => {
    const session = await loginWithEnv(page);
    const csrfToken = session.data?.csrfToken;
    const ownHandle = session.data?.user?.handle;
    const targetHandle = (process.env.THIA_FOLLOW_TARGET_HANDLE ?? "thia")
      .replace(/^@/, "")
      .toLowerCase();

    expect(csrfToken).toEqual(expect.any(String));
    expect(ownHandle).toEqual(expect.any(String));

    test.skip(
      targetHandle === ownHandle?.toLowerCase(),
      "THIA_FOLLOW_TARGET_HANDLE must not be the authenticated user's own handle.",
    );

    const targetProfile = await getProfile(page, targetHandle);
    test.skip(!targetProfile.ok, "THIA_FOLLOW_TARGET_HANDLE must point to an existing profile.");

    const selfFollow = await mutateFollow(page, ownHandle!, "POST", csrfToken!);
    expect(selfFollow.ok).toBe(false);
    expect(selfFollow.status).toBe(422);

    const reset = await mutateFollow(page, targetHandle, "DELETE", csrfToken!);
    expect(reset.ok).toBe(true);
    expect(reset.data?.isFollowing).toBe(false);

    const baselineFollowerCount = reset.data!.followerCount;
    const followed = await mutateFollow(page, targetHandle, "POST", csrfToken!);
    expect(followed.ok).toBe(true);
    expect(followed.data).toMatchObject({
      isFollowing: true,
      followerCount: baselineFollowerCount + 1,
    });
    expect(typeof followed.data?.isFollowedBy).toBe("boolean");
    expect(typeof followed.data?.isMoot).toBe("boolean");

    const duplicate = await mutateFollow(page, targetHandle, "POST", csrfToken!);
    expect(duplicate.ok).toBe(true);
    expect(duplicate.data?.followerCount).toBe(followed.data?.followerCount);

    const followedProfile = await getProfile(page, targetHandle);
    expect(followedProfile.ok).toBe(true);
    expect(followedProfile.data).toMatchObject({
      followerCount: baselineFollowerCount + 1,
      isFollowing: true,
    });

    await page.goto(`/@${targetHandle}`);
    await expect(page.getByTestId("profile-follow-button")).toHaveText("Following");

    const unfollowed = await mutateFollow(page, targetHandle, "DELETE", csrfToken!);
    expect(unfollowed.ok).toBe(true);
    expect(unfollowed.data).toMatchObject({
      isFollowing: false,
      followerCount: baselineFollowerCount,
    });

    const finalProfile = await getProfile(page, targetHandle);
    expect(finalProfile.ok).toBe(true);
    expect(finalProfile.data).toMatchObject({
      followerCount: baselineFollowerCount,
      isFollowing: false,
    });
  });
});

async function getProfile(
  page: Page,
  handle: string,
): Promise<ApiEnvelope<ProfileResponse> & { status: number }> {
  return page.evaluate(async (profileHandle) => {
    const response = await fetch(`/api/profiles/${encodeURIComponent(profileHandle)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const json = (await response.json()) as ApiEnvelope<ProfileResponse>;

    return {
      ...json,
      status: response.status,
    };
  }, handle);
}

async function mutateFollow(
  page: Page,
  handle: string,
  method: "POST" | "DELETE",
  csrfToken: string,
): Promise<ApiEnvelope<FollowRelationship> & { status: number }> {
  return page.evaluate(
    async ({ csrf, profileHandle, requestMethod }) => {
      const response = await fetch(
        `/api/profiles/${encodeURIComponent(profileHandle)}/follow`,
        {
          method: requestMethod,
          credentials: "include",
          headers: {
            Accept: "application/json",
            "X-CSRF-Token": csrf,
          },
        },
      );
      const json = (await response.json()) as ApiEnvelope<FollowRelationship>;

      return {
        ...json,
        status: response.status,
      };
    },
    { csrf: csrfToken, profileHandle: handle, requestMethod: method },
  );
}
