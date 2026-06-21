import {
  AtSign,
  BellRing,
  ChevronDown,
  Clock3,
  FileText,
  Fingerprint,
  KeyRound,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  UserRound,
  X,
  type LucideIcon,
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

const settingsNavItems = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "consent", label: "Consent", icon: SlidersHorizontal },
  { id: "content", label: "Content", icon: FileText },
  { id: "danger", label: "Danger", icon: Trash2 },
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

  const enabledNotificationCount = notificationKeys.filter(
    ([key]) => preferences?.notifications[key] ?? true,
  ).length;
  const consentEnabledCount = [
    preferences?.analyticsConsent,
    preferences?.personalizationConsent,
    preferences?.richEmbedsConsent,
    preferences?.autoplayMediaConsent,
    preferences?.sensitiveContentVisible,
  ].filter(Boolean).length;
  const deletionActive = Boolean(
    settings.deletion?.requestedAt &&
      !settings.deletion.canceledAt &&
      !settings.deletion.completedAt,
  );
  const deletionScheduledFor = settings.deletion?.scheduledFor ?? "the scheduled date";
  const visibilityLabel =
    settings.privacy.profileVisibility === "private" ? "Private" : "Public";
  const twoFactorLabel = settings.twoFactor.enabled ? "2FA on" : "2FA off";

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 lg:px-6">
      <PageMeta title="Settings" description="Manage your thia.lol account." path="/settings" />
      <section className="relative mb-4 overflow-hidden rounded-panel border border-line bg-surface/82 p-4 shadow-soft backdrop-blur-veil sm:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Badge tone="cool" className="min-h-6 px-2.5 text-[0.68rem] uppercase tracking-[0.12em]">
              control room
            </Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-text sm:text-4xl">
              Settings
            </h1>
            <p className="mt-1 text-sm text-muted">
              {settings.account.displayName} · @{user?.handle ?? settings.account.handle}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[26rem]">
            <InlineStatus
              icon={Lock}
              label={visibilityLabel}
              tone={settings.privacy.profileVisibility === "private" ? "warm" : "cool"}
            />
            <InlineStatus
              icon={Fingerprint}
              label={twoFactorLabel}
              tone={settings.twoFactor.enabled ? "cool" : "default"}
            />
            <InlineStatus
              icon={BellRing}
              label={`${enabledNotificationCount}/${notificationKeys.length} alerts`}
              tone="default"
            />
          </div>
        </div>
      </section>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <SettingsRail />

        <div className="space-y-4">
          <SettingsSection
            id="account"
            title="Account"
            kicker="Identity"
            icon={UserRound}
            badge={settings.account.status}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <StatusTile icon={Mail} label="Email" value={settings.account.email} />
              <StatusTile icon={AtSign} label="Handle" value={`@${settings.account.handle}`} />
            </div>

            <div className="mt-3 grid gap-2 xl:grid-cols-2">
              <ActionDetails icon={Mail} title="Change email" meta={settings.account.email}>
              <form className="space-y-3" onSubmit={handleEmailSubmit}>
                <TextField
                  id="settings-email"
                  name="email"
                  label="Email"
                  type="email"
                  defaultValue={settings?.account.email ?? ""}
                  icon={Mail}
                  density="compact"
                  required
                />
                <TextField
                  id="settings-email-password"
                  name="currentPassword"
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  density="compact"
                  required
                />
                <Button type="submit" size="sm" icon={<Save size={15} />} disabled={busy === "email"}>
                  Save email
                </Button>
              </form>
              </ActionDetails>

              <ActionDetails
                icon={AtSign}
                title="Change handle"
                meta={
                  settings?.account.handleChange.canChange === false
                    ? "Cooldown active"
                    : `@${settings.account.handle}`
                }
              >
              <form className="space-y-3" onSubmit={handleHandleSubmit}>
                <HandleField
                  id="settings-handle"
                  name="handle"
                  label="Handle"
                  defaultValue={settings?.account.handle ?? ""}
                  disabled={settings?.account.handleChange.canChange === false}
                  density="compact"
                  required
                  maxLength={41}
                />
                <TextField
                  id="settings-handle-password"
                  name="currentPassword"
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  density="compact"
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
                  icon={<Save size={15} />}
                  size="sm"
                >
                  Save handle
                </Button>
              </form>
              </ActionDetails>
            </div>
          </SettingsSection>

          <SettingsSection
            id="security"
            title="Security"
            kicker="Access"
            icon={ShieldCheck}
            badge={twoFactorLabel}
          >
            <ActionDetails icon={KeyRound} title="Password" meta="Update credentials">
            <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={handlePasswordSubmit}>
              <TextField
                id="settings-password-current"
                name="currentPassword"
                label="Current password"
                type="password"
                autoComplete="current-password"
                density="compact"
                required
              />
              <TextField
                id="settings-password-new"
                name="newPassword"
                label="New password"
                type="password"
                autoComplete="new-password"
                density="compact"
                minLength={10}
                maxLength={255}
                required
              />
              <Button type="submit" size="sm" className="self-end" icon={<Save size={15} />} disabled={busy === "password"}>
                Save
              </Button>
            </form>
            </ActionDetails>

            <div className="mt-2">
            <ActionDetails
              icon={Fingerprint}
              title="Two-factor authentication"
              meta={
                settings?.twoFactor.enabled
                  ? `${settings.twoFactor.backupCodeCount} recovery codes`
                  : "Authenticator app"
              }
              badge={
                settings?.twoFactor.enabled ? (
                  <Badge tone="cool" className="min-h-6 px-2 text-[0.68rem]">enabled</Badge>
                ) : (
                  <Badge className="min-h-6 px-2 text-[0.68rem]">off</Badge>
                )
              }
              defaultOpen={Boolean(twoFactorSetup)}
            >
              {!settings?.twoFactor.enabled ? (
                <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleTwoFactorSetup}>
                  <TextField
                    id="settings-2fa-password"
                    name="currentPassword"
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    density="compact"
                    required
                  />
                  <Button
                    type="submit"
                    size="sm"
                    icon={<Sparkles size={15} />}
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
                      density="compact"
                      required
                    />
                    <Button type="submit" size="sm" className="self-end" variant="secondary">
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
                      density="compact"
                      required
                    />
                    <Button type="submit" size="sm" className="self-end" variant="secondary">
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
                    density="compact"
                    required
                  />
                  <Button type="submit" size="sm" icon={<ShieldCheck size={15} />} disabled={busy === "2fa-enable"}>
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
            </ActionDetails>
            </div>
          </SettingsSection>

          <SettingsSection
            id="privacy"
            title="Privacy"
            kicker="Visibility"
            icon={Lock}
            badge={visibilityLabel}
          >
            <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handlePrivacySubmit}>
              <SelectField
                id="settings-profile-visibility"
                name="profileVisibility"
                label="Profile visibility"
                defaultValue={settings?.privacy.profileVisibility ?? "public"}
                density="compact"
                options={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private, approved followers only" },
                ]}
              />
              <Button type="submit" size="sm" icon={<Save size={15} />} className="self-end" disabled={busy === "privacy"}>
                Save privacy
              </Button>
            </form>

            <div className="mt-3">
            <ActionDetails
              icon={UserPlus}
              title="Follow requests"
              meta={`${followRequests.length} pending`}
              defaultOpen={followRequests.length > 0}
            >
              {followRequests.length === 0 ? (
                <p className="rounded-card border border-line bg-canvas/35 p-3 text-sm text-muted">
                  No pending requests.
                </p>
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
                        icon={<UserCheck size={14} />}
                        onClick={() => void handleFollowRequest(request.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        icon={<X size={14} />}
                        onClick={() => void handleFollowRequest(request.id, "deny")}
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </ActionDetails>
            </div>
          </SettingsSection>

          <SettingsSection
            id="consent"
            title="Consent"
            kicker="Preferences"
            icon={SlidersHorizontal}
            badge={`${consentEnabledCount}/5 enabled`}
          >
            <form className="space-y-3" onSubmit={handlePreferencesSubmit}>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <PreferenceToggle
                  name="analyticsConsent"
                  label="Analytics"
                  defaultChecked={preferences?.analyticsConsent}
                />
                <PreferenceToggle
                  name="personalizationConsent"
                  label="Discovery"
                  defaultChecked={preferences?.personalizationConsent}
                />
                <PreferenceToggle
                  name="richEmbedsConsent"
                  label="Rich embeds"
                  defaultChecked={preferences?.richEmbedsConsent}
                />
                <PreferenceToggle
                  name="autoplayMediaConsent"
                  label="Autoplay"
                  defaultChecked={preferences?.autoplayMediaConsent}
                />
                <PreferenceToggle
                  name="sensitiveContentVisible"
                  label="Sensitive content"
                  defaultChecked={preferences?.sensitiveContentVisible}
                />
              </div>

              <ActionDetails
                icon={BellRing}
                title="Notification categories"
                meta={`${enabledNotificationCount} enabled`}
              >
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
              </ActionDetails>

              <Button type="submit" size="sm" icon={<Save size={15} />} disabled={busy === "preferences"}>
                Save preferences
              </Button>
            </form>
          </SettingsSection>

          <SettingsSection
            id="content"
            title="Content"
            kicker="Posts"
            icon={FileText}
            badge={`${posts.length} shown`}
          >
            <div className="flex flex-wrap items-end gap-3">
              <SelectField
                id="settings-post-kind"
                label="Content"
                value={postKind}
                density="compact"
                onChange={(event) =>
                  setPostKind(event.currentTarget.value as "posts" | "replies" | "all")
                }
                options={[
                  { value: "all", label: "Posts and replies" },
                  { value: "posts", label: "Posts" },
                  { value: "replies", label: "Replies" },
                ]}
              />
              <Badge className="mb-1 min-h-8 px-3">{posts.length} item{posts.length === 1 ? "" : "s"}</Badge>
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

            <div className="mt-3">
              <ActionDetails icon={Trash2} title="Bulk delete" meta="Selected content" danger>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-rose/25 bg-rose/10 p-3">
                  <p className="text-sm text-rose-ink">
                    Delete all currently shown {postKind === "all" ? "posts and replies" : postKind}.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<Trash2 size={14} />}
                    onClick={() => void handleDeletePosts()}
                  >
                    Delete shown
                  </Button>
                </div>
              </ActionDetails>
            </div>
          </SettingsSection>

          <SettingsSection
            id="danger"
            title="Danger"
            kicker="Account"
            icon={Trash2}
            badge={deletionActive ? "pending" : "available"}
            danger
          >
            {deletionActive ? (
              <div className="rounded-card border border-amber/40 bg-amber/10 p-3 text-sm text-text">
                Deletion is scheduled for {deletionScheduledFor}.
                <Button
                  type="button"
                  className="mt-3"
                  variant="secondary"
                  size="sm"
                  icon={<Clock3 size={14} />}
                  onClick={() => void handleCancelDeletion()}
                >
                  Cancel deletion
                </Button>
              </div>
            ) : null}

            <div className="mt-3">
              <ActionDetails icon={Trash2} title="Schedule account deletion" meta="30-day grace" danger>
                <form className="space-y-3" onSubmit={handleDeletionSubmit}>
                  <TextField
                    id="settings-delete-password"
                    name="currentPassword"
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    density="compact"
                    required
                  />
                  <TextareaField
                    id="settings-delete-reason"
                    name="reason"
                    label="Reason"
                    rows={3}
                    maxLength={255}
                    density="compact"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    icon={<Trash2 size={14} />}
                    disabled={busy === "account-delete"}
                  >
                    Schedule deletion
                  </Button>
                  <p className="text-xs leading-5 text-muted">
                    Your profile and content are hidden immediately. You can sign in and cancel within 30 days.
                  </p>
                </form>
              </ActionDetails>
            </div>
          </SettingsSection>
        </div>
      </div>
    </main>
  );
}

function SettingsSection({
  children,
  icon,
  id,
  kicker,
  badge,
  danger,
  title,
}: {
  children: ReactNode;
  icon: LucideIcon;
  id: string;
  kicker: string;
  badge?: ReactNode;
  danger?: boolean;
  title: string;
}) {
  const Icon = icon;

  return (
    <Panel
      id={id}
      className={cn(
        "scroll-mt-24 overflow-hidden p-0",
        danger && "border-rose/25 bg-rose/5",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-control border bg-canvas/60",
              danger ? "border-rose/25 text-rose-ink" : "border-line text-accent-strong",
            )}
          >
            <Icon aria-hidden="true" size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {kicker}
            </p>
            <h2 className="truncate text-base font-semibold text-text">{title}</h2>
          </div>
        </div>
        {badge ? (
          <Badge
            tone={danger ? "rose" : "default"}
            className="min-h-6 shrink-0 px-2 text-[0.68rem]"
          >
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="p-3 sm:p-4">
      {children}
      </div>
    </Panel>
  );
}

function SettingsRail() {
  return (
    <nav className="hidden lg:block" aria-label="Settings sections">
      <Panel className="sticky top-24 p-2">
        <div className="grid gap-1">
          {settingsNavItems.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex min-h-10 items-center gap-2 rounded-control px-3 text-sm font-medium text-muted transition duration-fluid hover:bg-surface-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </a>
          ))}
        </div>
      </Panel>
    </nav>
  );
}

function InlineStatus({
  icon: Icon,
  label,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  tone?: "default" | "cool" | "warm";
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-card border px-3 text-sm font-semibold",
        tone === "cool" && "border-cool/30 bg-cool/12 text-cool-ink",
        tone === "warm" && "border-warm/35 bg-warm/12 text-warm-ink",
        tone === "default" && "border-line bg-canvas/45 text-text",
      )}
    >
      <Icon aria-hidden="true" size={16} />
      <span className="truncate">{label}</span>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-card border border-line bg-canvas/38 px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-control border border-line bg-surface/70 text-muted">
        <Icon aria-hidden="true" size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-text">{value}</p>
      </div>
    </div>
  );
}

function ActionDetails({
  badge,
  children,
  danger,
  defaultOpen,
  icon: Icon,
  meta,
  title,
}: {
  badge?: ReactNode;
  children: ReactNode;
  danger?: boolean;
  defaultOpen?: boolean;
  icon: LucideIcon;
  meta?: ReactNode;
  title: string;
}) {
  return (
    <details
      className={cn(
        "group overflow-hidden rounded-card border bg-canvas/34",
        danger ? "border-rose/25" : "border-line",
      )}
      open={defaultOpen ? true : undefined}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2 transition duration-fluid hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-control border bg-surface/70",
            danger ? "border-rose/25 text-rose-ink" : "border-line text-muted",
          )}
        >
          <Icon aria-hidden="true" size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">{title}</span>
          {meta ? <span className="block truncate text-xs text-muted">{meta}</span> : null}
        </span>
        {badge}
        <ChevronDown
          aria-hidden="true"
          className="shrink-0 text-muted transition duration-fluid group-open:rotate-180"
          size={16}
        />
      </summary>
      <div className="border-t border-line/70 p-3">{children}</div>
    </details>
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
        "flex items-center justify-between gap-3 rounded-card border border-line bg-canvas/35 transition duration-fluid hover:border-line-strong hover:bg-surface/60",
        compact ? "px-3 py-2 text-sm" : "px-3 py-2.5 text-sm",
      )}
    >
      <span className="font-medium text-text">{label}</span>
      <input
        className="peer sr-only"
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked ?? false}
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full border border-line bg-canvas shadow-inner-soft transition duration-fluid after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-muted after:transition after:duration-fluid peer-checked:border-accent/50 peer-checked:bg-accent peer-checked:after:translate-x-5 peer-checked:after:bg-accent-ink" />
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
