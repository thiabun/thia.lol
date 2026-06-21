import {
  Bell,
  Check,
  Lock,
  Mail,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";
import {
  HandleField,
  SelectField,
  TextareaField,
  TextField,
} from "../components/ui/Field";
import {
  approveFollowRequest,
  cancelAccountDeletion,
  deleteMyPosts,
  denyFollowRequest,
  disableTwoFactor,
  enableTwoFactor,
  getAccountSettings,
  getFollowRequests,
  getMyPosts,
  regenerateTwoFactorRecoveryCodes,
  scheduleAccountDeletion,
  startTwoFactorSetup,
  updateAccountEmail,
  updateAccountHandle,
  updateAccountPassword,
  updateAccountPreferences,
  updateAccountPrivacy,
  type AccountPostSummary,
  type AccountPreferences,
  type AccountSettings,
  type FollowRequest,
  type TwoFactorSetupResult,
} from "../lib/api";
import { cn } from "../lib/classNames";
import { useAuth } from "../lib/useAuth";

const notificationKeys = [
  ["mentions", "Mentions"],
  ["follows", "Follows"],
  ["moots", "Moots"],
  ["messages", "Messages"],
  ["likes", "Likes"],
  ["replies", "Replies"],
  ["reblogs", "Reblogs"],
  ["badges", "Badges"],
] as const;

export function SettingsPage() {
  const { clearSession, refreshSession, runWithAuth, status, user } = useAuth();
  const [settings, setSettings] = useState<AccountSettings>();
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [posts, setPosts] = useState<AccountPostSummary[]>([]);
  const [postKind, setPostKind] = useState<"posts" | "replies" | "all">("all");
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupResult>();
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  useEffect(() => {
    if (status !== "authenticated") {
      return undefined;
    }

    let active = true;

    Promise.all([getAccountSettings(), getFollowRequests(), getMyPosts(postKind)])
      .then(([nextSettings, nextRequests, nextPosts]) => {
        if (!active) {
          return;
        }

        setSettings(nextSettings);
        setFollowRequests(nextRequests);
        setPosts(nextPosts);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Settings could not load.");
        }
      });

    return () => {
      active = false;
    };
  }, [postKind, status]);

  if (status === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  if (status === "loading" || !settings) {
    return (
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 lg:px-6">
        <PageMeta title="Settings" description="Manage your thia.lol account." path="/settings" />
        <Panel className="p-5 text-sm text-muted">
          {error ?? "Loading settings."}
        </Panel>
      </main>
    );
  }

  const preferences = settings.preferences;

  async function runAction(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError(undefined);
    setMessage(undefined);

    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action could not be saved.");
    } finally {
      setBusy(undefined);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction("email", async () => {
      const next = await runWithAuth(
        (token) =>
          updateAccountEmail(
            {
              email: stringField(form, "email"),
              currentPassword: stringField(form, "currentPassword", false),
            },
            token,
          ),
        { retryOnCsrf: true },
      );
      setSettings(next);
      await refreshSession();
      setMessage("Email updated.");
    });
  }

  async function handleHandleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction("handle", async () => {
      const next = await runWithAuth(
        (token) =>
          updateAccountHandle(
            {
              handle: stringField(form, "handle"),
              currentPassword: stringField(form, "currentPassword", false),
            },
            token,
          ),
        { retryOnCsrf: true },
      );
      setSettings(next);
      await refreshSession();
      setMessage("Handle updated.");
    });
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction("password", async () => {
      await runWithAuth(
        (token) =>
          updateAccountPassword(
            {
              currentPassword: stringField(form, "currentPassword", false),
              newPassword: stringField(form, "newPassword", false),
            },
            token,
          ),
        { retryOnCsrf: true },
      );
      setMessage("Password updated. Other sessions were signed out.");
    });
  }

  async function handlePrivacySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profileVisibility =
      stringField(form, "profileVisibility") === "private" ? "private" : "public";

    await runAction("privacy", async () => {
      const next = await runWithAuth(
        (token) => updateAccountPrivacy({ profileVisibility }, token),
        { retryOnCsrf: true },
      );
      setSettings(next);
      setMessage("Privacy updated.");
    });
  }

  async function handlePreferencesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextPreferences = preferencesFromForm(form, preferences);

    await runAction("preferences", async () => {
      const next = await runWithAuth(
        (token) => updateAccountPreferences(nextPreferences, token),
        { retryOnCsrf: true },
      );
      setSettings(next);
      setMessage("Consent and notification settings saved.");
    });
  }

  async function handleTwoFactorSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction("2fa-setup", async () => {
      const result = await runWithAuth(
        (token) => startTwoFactorSetup(stringField(form, "currentPassword", false), token),
        { retryOnCsrf: true },
      );
      setTwoFactorSetup(result);
      setSettings((current) =>
        current ? { ...current, twoFactor: result.twoFactor } : current,
      );
      setMessage("Authenticator setup started.");
    });
  }

  async function handleTwoFactorEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction("2fa-enable", async () => {
      const result = await runWithAuth(
        (token) => enableTwoFactor(stringField(form, "code"), token),
        { retryOnCsrf: true },
      );
      setBackupCodes(result.backupCodes);
      setSettings((current) =>
        current ? { ...current, twoFactor: result.twoFactor } : current,
      );
      setTwoFactorSetup(undefined);
      setMessage("Two-factor authentication enabled.");
    });
  }

  async function handleTwoFactorDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction("2fa-disable", async () => {
      const result = await runWithAuth(
        (token) => disableTwoFactor(stringField(form, "currentPassword", false), token),
        { retryOnCsrf: true },
      );
      setSettings((current) =>
        current ? { ...current, twoFactor: result.twoFactor } : current,
      );
      setBackupCodes([]);
      setMessage("Two-factor authentication disabled.");
    });
  }

  async function handleRegenerateCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction("2fa-codes", async () => {
      const result = await runWithAuth(
        (token) =>
          regenerateTwoFactorRecoveryCodes(
            stringField(form, "currentPassword", false),
            token,
          ),
        { retryOnCsrf: true },
      );
      setBackupCodes(result.backupCodes);
      setSettings((current) =>
        current ? { ...current, twoFactor: result.twoFactor } : current,
      );
      setMessage("Recovery codes regenerated.");
    });
  }

  async function handleFollowRequest(id: number, action: "approve" | "deny") {
    await runAction(`follow-${id}`, async () => {
      await runWithAuth(
        async (token) => {
          if (action === "approve") {
            await approveFollowRequest(id, token);
            return;
          }

          await denyFollowRequest(id, token);
        },
        { retryOnCsrf: true },
      );
      setFollowRequests((current) => current.filter((request) => request.id !== id));
      setMessage(action === "approve" ? "Follow request approved." : "Request denied.");
    });
  }

  async function handleDeletePosts() {
    await runAction("posts-delete", async () => {
      const result = await runWithAuth(
        (token) => deleteMyPosts(postKind, token),
        { retryOnCsrf: true },
      );
      setPosts(await getMyPosts(postKind));
      setMessage(`${result.deletedCount} item${result.deletedCount === 1 ? "" : "s"} deleted.`);
    });
  }

  async function handleDeletionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction("account-delete", async () => {
      await runWithAuth(
        (token) =>
          scheduleAccountDeletion(
            stringField(form, "currentPassword", false),
            stringField(form, "reason"),
            token,
          ),
        { retryOnCsrf: true },
      );
      clearSession();
    });
  }

  async function handleCancelDeletion() {
    await runAction("cancel-deletion", async () => {
      const next = await runWithAuth((token) => cancelAccountDeletion(token), {
        retryOnCsrf: true,
      });
      setSettings(next);
      setMessage("Account deletion canceled.");
    });
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 lg:px-6">
      <PageMeta title="Settings" description="Manage your thia.lol account." path="/settings" />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="cool">settings</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-text">
            Account settings
          </h1>
          <p className="mt-2 text-sm text-muted">
            Signed in as {user ? `@${user.handle}` : "your account"}.
          </p>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
        <div className="space-y-4">
          <SettingsSection title="Account" icon={<UserRound size={18} />}>
            <div className="grid gap-4 xl:grid-cols-2">
              <form className="space-y-3" onSubmit={handleEmailSubmit}>
                <TextField
                  id="settings-email"
                  name="email"
                  label="Email"
                  type="email"
                  defaultValue={settings?.account.email ?? ""}
                  icon={Mail}
                  required
                />
                <TextField
                  id="settings-email-password"
                  name="currentPassword"
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <Button type="submit" disabled={busy === "email"}>
                  Save email
                </Button>
              </form>
              <form className="space-y-3" onSubmit={handleHandleSubmit}>
                <HandleField
                  id="settings-handle"
                  name="handle"
                  label="Handle"
                  defaultValue={settings?.account.handle ?? ""}
                  disabled={settings?.account.handleChange.canChange === false}
                  required
                  maxLength={41}
                />
                <TextField
                  id="settings-handle-password"
                  name="currentPassword"
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                {settings?.account.handleChange.canChange === false ? (
                  <p className="text-xs text-muted">
                    Next change allowed {settings.account.handleChange.nextAllowedAt}.
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={
                    busy === "handle" ||
                    settings?.account.handleChange.canChange === false
                  }
                >
                  Save handle
                </Button>
              </form>
            </div>
          </SettingsSection>

          <SettingsSection title="Security" icon={<ShieldCheck size={18} />}>
            <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={handlePasswordSubmit}>
              <TextField
                id="settings-password-current"
                name="currentPassword"
                label="Current password"
                type="password"
                autoComplete="current-password"
                required
              />
              <TextField
                id="settings-password-new"
                name="newPassword"
                label="New password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={255}
                required
              />
              <Button type="submit" className="self-end" disabled={busy === "password"}>
                Save
              </Button>
            </form>

            <div className="mt-5 rounded-card border border-line bg-canvas/35 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-text">Two-factor authentication</p>
                  <p className="mt-1 text-sm text-muted">
                    {settings?.twoFactor.enabled
                      ? `${settings.twoFactor.backupCodeCount} recovery codes remaining.`
                      : "Protect sign-ins with an authenticator app."}
                  </p>
                </div>
                <Badge tone={settings?.twoFactor.enabled ? "cool" : "default"}>
                  {settings?.twoFactor.enabled ? "enabled" : "off"}
                </Badge>
              </div>

              {!settings?.twoFactor.enabled ? (
                <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleTwoFactorSetup}>
                  <TextField
                    id="settings-2fa-password"
                    name="currentPassword"
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                  <Button
                    type="submit"
                    className="self-end"
                    disabled={busy === "2fa-setup"}
                  >
                    Start setup
                  </Button>
                </form>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <form className="flex gap-3" onSubmit={handleRegenerateCodes}>
                    <TextField
                      id="settings-2fa-codes-password"
                      name="currentPassword"
                      label="Current password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                    <Button type="submit" className="self-end" variant="secondary">
                      New codes
                    </Button>
                  </form>
                  <form className="flex gap-3" onSubmit={handleTwoFactorDisable}>
                    <TextField
                      id="settings-2fa-disable-password"
                      name="currentPassword"
                      label="Current password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                    <Button type="submit" className="self-end" variant="secondary">
                      Disable
                    </Button>
                  </form>
                </div>
              )}

              {twoFactorSetup ? (
                <form className="mt-4 space-y-3" onSubmit={handleTwoFactorEnable}>
                  <div className="rounded-card border border-line bg-surface/65 p-3">
                    <p className="text-sm font-semibold text-text">Manual secret</p>
                    <p className="mt-2 break-all font-mono text-sm text-accent-strong">
                      {twoFactorSetup.setup.manualSecret}
                    </p>
                    <p className="mt-2 break-all text-xs text-muted">
                      {twoFactorSetup.setup.otpauthUri}
                    </p>
                  </div>
                  <TextField
                    id="settings-2fa-code"
                    name="code"
                    label="Authenticator code"
                    autoComplete="one-time-code"
                    required
                  />
                  <Button type="submit" disabled={busy === "2fa-enable"}>
                    Enable two-factor
                  </Button>
                </form>
              ) : null}

              {backupCodes.length > 0 ? (
                <div className="mt-4 rounded-card border border-line bg-surface/65 p-3">
                  <p className="text-sm font-semibold text-text">Recovery codes</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {backupCodes.map((code) => (
                      <code key={code} className="rounded-control bg-canvas px-3 py-2 text-sm">
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </SettingsSection>

          <SettingsSection title="Privacy" icon={<Lock size={18} />}>
            <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handlePrivacySubmit}>
              <SelectField
                id="settings-profile-visibility"
                name="profileVisibility"
                label="Profile visibility"
                defaultValue={settings?.privacy.profileVisibility ?? "public"}
                options={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private, approved followers only" },
                ]}
              />
              <Button type="submit" className="self-end" disabled={busy === "privacy"}>
                Save privacy
              </Button>
            </form>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-text">Follow requests</p>
              {followRequests.length === 0 ? (
                <p className="text-sm text-muted">No pending requests.</p>
              ) : (
                followRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-canvas/35 p-3"
                  >
                    <div>
                      <p className="font-semibold text-text">{request.user.displayName}</p>
                      <p className="text-sm text-muted">@{request.user.handle}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleFollowRequest(request.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleFollowRequest(request.id, "deny")}
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SettingsSection>
        </div>

        <div className="space-y-4">
          <SettingsSection title="Consent" icon={<Check size={18} />}>
            <form className="space-y-3" onSubmit={handlePreferencesSubmit}>
              <PreferenceToggle
                name="analyticsConsent"
                label="Analytics cookies"
                defaultChecked={preferences?.analyticsConsent}
              />
              <PreferenceToggle
                name="personalizationConsent"
                label="Personalized discovery"
                defaultChecked={preferences?.personalizationConsent}
              />
              <PreferenceToggle
                name="richEmbedsConsent"
                label="Rich embeds"
                defaultChecked={preferences?.richEmbedsConsent}
              />
              <PreferenceToggle
                name="autoplayMediaConsent"
                label="Autoplay media"
                defaultChecked={preferences?.autoplayMediaConsent}
              />
              <PreferenceToggle
                name="sensitiveContentVisible"
                label="Show sensitive content"
                defaultChecked={preferences?.sensitiveContentVisible}
              />
              <p className="pt-2 text-sm font-semibold text-text">In-app notifications</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {notificationKeys.map(([key, label]) => (
                  <PreferenceToggle
                    key={key}
                    name={`notification:${key}`}
                    label={label}
                    defaultChecked={preferences?.notifications[key] ?? true}
                    compact
                  />
                ))}
              </div>
              <Button type="submit" disabled={busy === "preferences"}>
                Save preferences
              </Button>
            </form>
          </SettingsSection>

          <SettingsSection title="Content" icon={<Bell size={18} />}>
            <div className="flex flex-wrap items-end gap-3">
              <SelectField
                id="settings-post-kind"
                label="Content"
                value={postKind}
                onChange={(event) =>
                  setPostKind(event.currentTarget.value as "posts" | "replies" | "all")
                }
                options={[
                  { value: "all", label: "Posts and replies" },
                  { value: "posts", label: "Posts" },
                  { value: "replies", label: "Replies" },
                ]}
              />
              <Button type="button" variant="secondary" onClick={() => void handleDeletePosts()}>
                Delete shown
              </Button>
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-auto pr-1">
              {posts.length === 0 ? (
                <p className="text-sm text-muted">No matching content.</p>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="rounded-card border border-line bg-canvas/35 p-3">
                    <p className="line-clamp-2 text-sm text-text">{post.body || "Media post"}</p>
                    <p className="mt-1 text-xs text-muted">
                      {post.kind} · {post.status}
                    </p>
                  </div>
                ))
              )}
            </div>
          </SettingsSection>

          <SettingsSection title="Danger Zone" icon={<Trash2 size={18} />}>
            {settings?.deletion && !settings.deletion.canceledAt ? (
              <div className="rounded-card border border-amber/40 bg-amber/10 p-3 text-sm text-text">
                Deletion is scheduled for {settings.deletion.scheduledFor}.
                <Button
                  type="button"
                  className="mt-3"
                  variant="secondary"
                  onClick={() => void handleCancelDeletion()}
                >
                  Cancel deletion
                </Button>
              </div>
            ) : null}
            <form className="space-y-3" onSubmit={handleDeletionSubmit}>
              <TextField
                id="settings-delete-password"
                name="currentPassword"
                label="Current password"
                type="password"
                autoComplete="current-password"
                required
              />
              <TextareaField
                id="settings-delete-reason"
                name="reason"
                label="Reason"
                rows={3}
                maxLength={255}
              />
              <Button type="submit" variant="secondary" disabled={busy === "account-delete"}>
                Schedule account deletion
              </Button>
              <p className="text-xs leading-5 text-muted">
                Your profile and content are hidden immediately. You can sign in and cancel
                within 30 days.
              </p>
            </form>
          </SettingsSection>
        </div>
      </div>
    </main>
  );
}

function SettingsSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Panel className="p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
        {icon}
        {title}
      </h2>
      {children}
    </Panel>
  );
}

function Notice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "error" | "success";
}) {
  return (
    <div
      className={cn(
        "mb-4 rounded-card border p-3 text-sm",
        tone === "error"
          ? "border-rose/30 bg-rose/15 text-rose-ink"
          : "border-mint/30 bg-mint/15 text-text",
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

function PreferenceToggle({
  compact,
  defaultChecked,
  label,
  name,
}: {
  compact?: boolean;
  defaultChecked?: boolean;
  label: string;
  name: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3 rounded-card border border-line bg-canvas/35",
        compact ? "px-3 py-2 text-sm" : "px-4 py-3",
      )}
    >
      <span className="font-medium text-text">{label}</span>
      <input
        className="size-5 accent-[var(--accent)]"
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked ?? false}
      />
    </label>
  );
}

function preferencesFromForm(
  form: FormData,
  fallback: AccountPreferences | undefined,
): AccountPreferences {
  const notifications: Record<string, boolean> = {};

  for (const [key] of notificationKeys) {
    notifications[key] = form.get(`notification:${key}`) === "on";
  }

  return {
    analyticsConsent: form.get("analyticsConsent") === "on",
    personalizationConsent: form.get("personalizationConsent") === "on",
    richEmbedsConsent: form.get("richEmbedsConsent") === "on",
    autoplayMediaConsent: form.get("autoplayMediaConsent") === "on",
    sensitiveContentVisible: form.get("sensitiveContentVisible") === "on",
    notifications,
    emailNotifications: fallback?.emailNotifications ?? {},
    pushNotifications: fallback?.pushNotifications ?? {},
  };
}

function stringField(form: FormData, name: string, trim = true): string {
  const value = form.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return trim ? value.trim() : value;
}
