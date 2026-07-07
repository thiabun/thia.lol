import {
  AtSign,
  BellRing,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Fingerprint,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { DesktopNotificationsCard } from "../components/notifications/DesktopNotificationsCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ModalSheet } from "../components/ui/ModalSheet";
import { Panel } from "../components/ui/Panel";
import {
  HandleField,
  SelectField,
  TextareaField,
  TextField,
} from "../components/ui/Field";
import {
  cancelAccountDeletion,
  deleteMyPosts,
  disableTwoFactor,
  enableTwoFactor,
  getAccountSettings,
  getMyPosts,
  regenerateTwoFactorRecoveryCodes,
  requestAccountDataExport,
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
  const [posts, setPosts] = useState<AccountPostSummary[]>([]);
  const [postKind, setPostKind] = useState<"posts" | "replies" | "all">("all");
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupResult>();
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [identityEditor, setIdentityEditor] = useState<"email" | "handle" | undefined>();
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  useEffect(() => {
    if (status !== "authenticated") {
      return undefined;
    }

    let active = true;

    Promise.all([getAccountSettings(), getMyPosts(postKind)])
      .then(([nextSettings, nextPosts]) => {
        if (!active) {
          return;
        }

        setSettings(nextSettings);
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
      setIdentityEditor(undefined);
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
      setIdentityEditor(undefined);
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

  async function handleConsentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextPreferences = preferencesFromForm(form, preferences, "consent");

    await runAction("consent", async () => {
      const next = await runWithAuth(
        (token) => updateAccountPreferences(nextPreferences, token),
        { retryOnCsrf: true },
      );
      setSettings(next);
      setMessage("Consent saved.");
    });
  }

  async function handleNotificationsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextPreferences = preferencesFromForm(form, preferences, "notifications");

    await runAction("notifications", async () => {
      const next = await runWithAuth(
        (token) => updateAccountPreferences(nextPreferences, token),
        { retryOnCsrf: true },
      );
      setSettings(next);
      setMessage("Notification settings saved.");
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

  async function handleDeleteAllPosts() {
    await runAction("posts-delete", async () => {
      const result = await runWithAuth(
        (token) => deleteMyPosts("all", token),
        { retryOnCsrf: true },
      );
      setPosts(await getMyPosts(postKind));
      setBulkDeleteConfirmOpen(false);
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

  async function handleDataExportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const exportHandle = settings?.account.handle ?? user?.handle ?? "account";

    await runAction("data-export", async () => {
      const exported = await runWithAuth(
        (token) =>
          requestAccountDataExport(
            stringField(form, "currentPassword", false),
            token,
          ),
        { retryOnCsrf: true },
      );

      downloadJsonExport(exported, exportHandle);
      setMessage("Data export downloaded.");
    });
  }

  const deletionActive = Boolean(
    settings.deletion?.requestedAt &&
      !settings.deletion.canceledAt &&
      !settings.deletion.completedAt,
  );
  const deletionScheduledFor = settings.deletion?.scheduledFor ?? "the scheduled date";
  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-4 lg:px-6">
      <PageMeta title="Settings" description="Manage your thia.lol account." path="/settings" />
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-normal text-text sm:text-4xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          {settings.account.displayName} · @{settings.account.handle}
        </p>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <div className="space-y-1">
          <SettingsSection
            id="account"
            title="Account"
            kicker="Identity"
            icon={UserRound}
          >
            <div className="grid gap-2 md:grid-cols-2">
              <AccountFactRow
                icon={Mail}
                label="Email"
                value={settings.account.email}
                actionLabel="Change email"
                onEdit={() => setIdentityEditor("email")}
              />
              <AccountFactRow
                icon={AtSign}
                label="Handle"
                value={`@${settings.account.handle}`}
                actionLabel="Change handle"
                onEdit={() => setIdentityEditor("handle")}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            id="security"
            title="Security"
            kicker="Access"
            icon={ShieldCheck}
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
          >
            <form
              className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:gap-3"
              onSubmit={handlePrivacySubmit}
            >
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
          </SettingsSection>

          <SettingsSection
            id="notifications"
            title="Notifications"
            kicker="Updates"
            icon={BellRing}
          >
            <ActionDetails
              icon={BellRing}
              title="Notification preferences"
              meta="Alerts and desktop"
            >
              <form className="space-y-4" onSubmit={handleNotificationsSubmit}>
                <div>
                  <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
                    Alerts
                  </p>
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
                </div>

                <div className="grid gap-3">
                  <DesktopNotificationsCard compact />
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
                    Desktop categories
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {notificationKeys.map(([key, label]) => (
                      <PreferenceToggle
                        key={key}
                        name={`pushNotification:${key}`}
                        label={label}
                        defaultChecked={preferences?.pushNotifications[key] ?? true}
                        compact
                      />
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  icon={<Save size={15} />}
                  disabled={busy === "notifications"}
                >
                  Save notifications
                </Button>
              </form>
            </ActionDetails>
          </SettingsSection>

          <SettingsSection
            id="data-rights"
            title="Data rights"
            kicker="Export"
            icon={Download}
          >
            <ActionDetails
              icon={Download}
              title="Download account data"
              meta="JSON export"
            >
              <form className="space-y-3" onSubmit={handleDataExportSubmit}>
                <p className="text-sm leading-6 text-muted">
                  Download a readable JSON snapshot of account, profile, content,
                  room, moderation, integration, and settings data we can safely
                  provide through self-service.
                </p>
                <TextField
                  id="settings-data-export-password"
                  name="currentPassword"
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  density="compact"
                  required
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    icon={<Download size={15} />}
                    disabled={busy === "data-export"}
                  >
                    Download export
                  </Button>
                  <Link
                    className="text-sm font-medium text-muted underline-offset-4 transition duration-fluid hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    to="/data-export"
                  >
                    Data Export Policy
                  </Link>
                  <Link
                    className="text-sm font-medium text-muted underline-offset-4 transition duration-fluid hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    to="/account-deletion"
                  >
                    Account Deletion Policy
                  </Link>
                </div>
              </form>
            </ActionDetails>
          </SettingsSection>

          <SettingsSection
            id="consent"
            title="Consent"
            kicker="Preferences"
            icon={SlidersHorizontal}
          >
            <form className="space-y-3" onSubmit={handleConsentSubmit}>
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

              <Button type="submit" size="sm" icon={<Save size={15} />} disabled={busy === "consent"}>
                Save consent
              </Button>
            </form>
          </SettingsSection>

          <SettingsSection
            id="content"
            title="Content"
            kicker="Posts"
            icon={FileText}
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

          </SettingsSection>

          <SettingsSection
            id="danger"
            title="Danger"
            kicker="Account"
            icon={Trash2}
            danger
          >
            <DangerAction
              icon={Trash2}
              title="Delete all posts and replies"
              description="Remove every post and reply from your account."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  icon={<Trash2 size={14} />}
                  onClick={() => setBulkDeleteConfirmOpen(true)}
                >
                  Delete all posts and replies
                </Button>
              }
            />

            {deletionActive ? (
              <div className="mt-3 rounded-card border border-amber/40 bg-amber/10 p-3 text-sm text-text">
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
                    variant="danger"
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

      <ModalSheet
        open={identityEditor === "email"}
        onClose={() => setIdentityEditor(undefined)}
        title="Change email"
        description={settings.account.email}
        closeLabel="Close email editor"
        size="sm"
        mobile="dialog"
        busy={busy === "email"}
      >
        <form className="space-y-3" onSubmit={handleEmailSubmit}>
          <TextField
            id="settings-email"
            name="email"
            label="Email"
            type="email"
            defaultValue={settings.account.email}
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
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy === "email"}
              onClick={() => setIdentityEditor(undefined)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" icon={<Save size={15} />} disabled={busy === "email"}>
              Save email
            </Button>
          </div>
        </form>
      </ModalSheet>

      <ModalSheet
        open={identityEditor === "handle"}
        onClose={() => setIdentityEditor(undefined)}
        title="Change handle"
        description={`@${settings.account.handle}`}
        closeLabel="Close handle editor"
        size="sm"
        mobile="dialog"
        busy={busy === "handle"}
      >
        <form className="space-y-3" onSubmit={handleHandleSubmit}>
          <HandleField
            id="settings-handle"
            name="handle"
            label="Handle"
            defaultValue={settings.account.handle}
            disabled={settings.account.handleChange.canChange === false}
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
          {settings.account.handleChange.canChange === false ? (
            <p className="text-xs text-muted">
              Next change allowed {settings.account.handleChange.nextAllowedAt}.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy === "handle"}
              onClick={() => setIdentityEditor(undefined)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                busy === "handle" ||
                settings.account.handleChange.canChange === false
              }
              icon={<Save size={15} />}
              size="sm"
            >
              Save handle
            </Button>
          </div>
        </form>
      </ModalSheet>

      <ModalSheet
        open={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title="Delete all posts and replies?"
        description="This removes your posts and replies from thia.lol."
        closeLabel="Close bulk delete confirmation"
        size="sm"
        mobile="dialog"
        busy={busy === "posts-delete"}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy === "posts-delete"}
              onClick={() => setBulkDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy === "posts-delete"}
              icon={<Trash2 size={14} />}
              onClick={() => void handleDeleteAllPosts()}
            >
              {busy === "posts-delete" ? "Deleting" : "Delete all"}
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-muted">
          This affects every post and reply, not just the current Content filter.
          Profile modules, media files, account settings, rooms, and messages are unchanged.
        </p>
      </ModalSheet>
    </main>
  );
}

function SettingsSection({
  children,
  icon,
  id,
  kicker,
  danger,
  title,
}: {
  children: ReactNode;
  icon: LucideIcon;
  id: string;
  kicker: string;
  danger?: boolean;
  title: string;
}) {
  const Icon = icon;

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 border-t border-line/65 py-5 first:border-t-0",
        danger && "mt-5 rounded-panel border border-rose/25 bg-rose/5 px-3 sm:px-4",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full bg-surface/65",
            danger ? "text-rose-ink" : "text-accent-strong",
          )}
        >
          <Icon aria-hidden="true" size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
            {kicker}
          </p>
          <h2 className="truncate text-base font-semibold text-text">{title}</h2>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AccountFactRow({
  actionLabel,
  icon: Icon,
  label,
  onEdit,
  value,
}: {
  actionLabel: string;
  icon: LucideIcon;
  label: string;
  onEdit: () => void;
  value: string;
}) {
  return (
    <div
      className="flex min-w-0 items-center gap-3 rounded-control border border-line bg-surface/60 px-3 py-2.5"
      data-testid={`settings-readout-${label.toLowerCase()}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-canvas/58 text-muted">
        <Icon aria-hidden="true" size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted/90">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-text">{value}</p>
      </div>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="size-9 shrink-0"
        aria-label={actionLabel}
        title={actionLabel}
        icon={<Pencil aria-hidden="true" size={15} />}
        onClick={onEdit}
      />
    </div>
  );
}

function downloadJsonExport(data: unknown, handle: string) {
  const date = new Date().toISOString().slice(0, 10);
  const safeHandle = handle.replace(/[^a-zA-Z0-9_-]/g, "-") || "account";
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `thia-lol-data-export-${safeHandle}-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
        "group overflow-hidden rounded-control border border-transparent bg-canvas/18",
        danger ? "bg-rose/5" : undefined,
      )}
      open={defaultOpen ? true : undefined}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-control px-2.5 py-2 transition duration-fluid hover:bg-surface/55 focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full bg-surface/58",
            danger ? "text-rose-ink" : "text-muted",
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
      <div className="border-t border-line/55 px-2.5 py-3">{children}</div>
    </details>
  );
}

function DangerAction({
  action,
  description,
  icon: Icon,
  title,
}: {
  action: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-rose/25 bg-rose/10 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rose/15 text-rose-ink">
          <Icon aria-hidden="true" size={16} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
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
  scope: "consent" | "notifications",
): AccountPreferences {
  const notifications: Record<string, boolean> = {};
  const pushNotifications: Record<string, boolean> = {};

  for (const [key] of notificationKeys) {
    notifications[key] =
      scope === "notifications"
        ? form.get(`notification:${key}`) === "on"
        : fallback?.notifications[key] ?? true;
    pushNotifications[key] =
      scope === "notifications"
        ? form.get(`pushNotification:${key}`) === "on"
        : fallback?.pushNotifications[key] ?? true;
  }

  return {
    analyticsConsent:
      scope === "consent"
        ? form.get("analyticsConsent") === "on"
        : fallback?.analyticsConsent ?? false,
    personalizationConsent:
      scope === "consent"
        ? form.get("personalizationConsent") === "on"
        : fallback?.personalizationConsent ?? true,
    richEmbedsConsent:
      scope === "consent"
        ? form.get("richEmbedsConsent") === "on"
        : fallback?.richEmbedsConsent ?? true,
    autoplayMediaConsent:
      scope === "consent"
        ? form.get("autoplayMediaConsent") === "on"
        : fallback?.autoplayMediaConsent ?? false,
    sensitiveContentVisible:
      scope === "consent"
        ? form.get("sensitiveContentVisible") === "on"
        : fallback?.sensitiveContentVisible ?? false,
    notifications,
    emailNotifications: fallback?.emailNotifications ?? {},
    pushNotifications,
  };
}

function stringField(form: FormData, name: string, trim = true): string {
  const value = form.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return trim ? value.trim() : value;
}
