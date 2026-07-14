import {
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  MousePointer2,
  Palette,
  Plus,
  Save,
  X,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "../../ui/Button";
import { cn } from "../../../lib/classNames";

export type ProfileStudioTool = "select" | "add" | "background" | "appearance";

type ProfileStudioShellProps = {
  activeTool: ProfileStudioTool;
  autosaveError: boolean;
  autosaveMessage: string;
  busy: boolean;
  children: ReactNode;
  error?: string | undefined;
  guideHighlighted?: boolean | undefined;
  handle: string;
  inspector: ReactNode;
  inspectorFocusKey: string;
  previewing: boolean;
  saveHighlighted?: boolean | undefined;
  onCancel: () => void;
  onGuideOpen: () => void;
  onPreviewToggle: () => void;
  onSave: () => void;
  onToolChange: (tool: ProfileStudioTool) => void;
};

const studioTools = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "add", icon: Plus, label: "Add" },
  { id: "background", icon: ImagePlus, label: "Background" },
  { id: "appearance", icon: Palette, label: "Appearance" },
] satisfies Array<{
  id: ProfileStudioTool;
  icon: typeof MousePointer2;
  label: string;
}>;

export function ProfileStudioShell({
  activeTool,
  autosaveError,
  autosaveMessage,
  busy,
  children,
  error,
  guideHighlighted = false,
  handle,
  inspector,
  inspectorFocusKey,
  previewing,
  saveHighlighted = false,
  onCancel,
  onGuideOpen,
  onPreviewToggle,
  onSave,
  onToolChange,
}: ProfileStudioShellProps) {
  const inspectorRef = useRef<HTMLElement | null>(null);
  const inspectorOriginRef = useRef<HTMLElement | null>(null);
  const previousInspectorFocusKeyRef = useRef(inspectorFocusKey);

  useEffect(() => {
    const previousKey = previousInspectorFocusKeyRef.current;

    if (previousKey === inspectorFocusKey) {
      return undefined;
    }

    previousInspectorFocusKeyRef.current = inspectorFocusKey;
    const wasContextual = /^(picker|settings):/.test(previousKey);
    const isContextual = /^(picker|settings):/.test(inspectorFocusKey);
    const activeElement = document.activeElement;
    const activeTool =
      activeElement instanceof HTMLElement &&
      activeElement.getAttribute("aria-controls") ===
        "profile-studio-inspector";

    if (
      !wasContextual &&
      isContextual &&
      activeElement instanceof HTMLElement
    ) {
      inspectorOriginRef.current = activeElement;
    }

    const frame = window.requestAnimationFrame(() => {
      if (wasContextual && !isContextual && !activeTool) {
        const origin = inspectorOriginRef.current;

        if (origin?.isConnected) {
          origin.focus({ preventScroll: true });
        } else {
          inspectorRef.current?.focus({ preventScroll: true });
        }

        inspectorOriginRef.current = null;
        return;
      }

      if (isContextual) {
        inspectorRef.current?.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [inspectorFocusKey]);

  function handleToolChange(tool: ProfileStudioTool) {
    onToolChange(tool);
    window.requestAnimationFrame(() => {
      inspectorRef.current?.focus({ preventScroll: true });
    });
  }

  return (
    <section
      className="profile-studio min-w-0 space-y-2"
      aria-label="Profile canvas editor"
      data-profile-studio-preview={previewing ? "true" : "false"}
    >
      <header
        className="site-profile-glass-surface sticky top-16 z-40 flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface/88 px-3 py-2 shadow-soft backdrop-blur-veil"
        data-testid="profile-canvas-editor-toolbar"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0 border-r border-line pr-3">
            <h1 className="truncate text-base font-semibold text-text">
              Profile studio
            </h1>
            <p className="truncate text-xs font-medium text-muted">@{handle}</p>
          </div>
          <p
            className={cn(
              "hidden min-w-0 items-center gap-1.5 truncate text-xs font-semibold sm:flex",
              autosaveError ? "text-rose-ink" : "text-muted",
            )}
            role={autosaveError ? "alert" : "status"}
          >
            <CheckCircle2 aria-hidden="true" className="shrink-0" size={15} />
            <span className="truncate">{autosaveMessage}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-label="Cancel profile editing"
            icon={<X aria-hidden="true" size={15} />}
            onClick={onCancel}
          >
            <span className="hidden xl:inline">Cancel</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={previewing ? "primary" : "secondary"}
            aria-label={previewing ? "Return to editing" : "Preview profile"}
            aria-pressed={previewing}
            icon={
              previewing ? (
                <EyeOff aria-hidden="true" size={15} />
              ) : (
                <Eye aria-hidden="true" size={15} />
              )
            }
            data-testid="profile-studio-preview-button"
            onClick={onPreviewToggle}
          >
            <span className="hidden xl:inline">
              {previewing ? "Edit" : "Preview"}
            </span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Open profile editor guide"
            icon={<BookOpen aria-hidden="true" size={15} />}
            data-testid="profile-editor-guide-button"
            onClick={onGuideOpen}
          >
            <span className="hidden xl:inline">Guide</span>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            className={cn(
              "px-3",
              saveHighlighted
                ? "outline outline-2 outline-focus/70 ring-4 ring-focus/15"
                : undefined,
            )}
            icon={<Save aria-hidden="true" size={15} />}
            data-testid="profile-canvas-save-button"
            onClick={onSave}
          >
            Save
          </Button>
        </div>
      </header>

      {error ? (
        <p
          className="rounded-card border border-rose/30 bg-rose/12 px-3 py-2 text-sm font-medium text-rose-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div
        className={cn(
          "profile-studio-workspace min-w-0",
          previewing
            ? "block"
            : "grid grid-cols-[7.25rem_minmax(0,1fr)] items-start gap-2 xl:grid-cols-[7.25rem_minmax(0,1fr)_minmax(17.5rem,20rem)]",
        )}
        aria-busy={busy}
      >
        {!previewing ? (
          <nav
            className="site-profile-glass-surface sticky top-[8.25rem] z-30 row-span-2 grid gap-1 rounded-card border border-line bg-surface/78 p-1.5 shadow-inner-soft backdrop-blur-veil xl:row-span-1"
            aria-label="Profile studio tools"
            data-testid="profile-studio-tools"
          >
            {studioTools.map(({ id, icon: Icon, label }) => {
              const active = activeTool === id;

              return (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "app-control relative grid min-h-[4.25rem] w-full min-w-0 place-items-center content-center gap-1 overflow-hidden rounded-control border px-1 text-[0.68rem] font-semibold transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-focus",
                    active
                      ? "border-accent/55 bg-accent/15 text-accent-strong shadow-inner-soft"
                      : "border-transparent text-muted hover:border-line hover:bg-surface/74 hover:text-text",
                  )}
                  aria-pressed={active}
                  aria-controls="profile-studio-inspector"
                  data-testid={`profile-studio-tool-${id}`}
                  onClick={() => handleToolChange(id)}
                >
                  <Icon aria-hidden="true" size={19} />
                  <span>{label}</span>
                  {guideHighlighted && id === "background" ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-control outline outline-2 outline-focus/80 ring-4 ring-focus/15"
                      data-testid="profile-editor-guide-target-highlight"
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>
        ) : null}

        <main
          className={cn(
            "min-w-0",
            previewing
              ? "mx-auto w-[min(calc(100vw-2rem),clamp(60rem,75vw,112.5rem))]"
              : "col-start-2 row-start-2 xl:col-start-2 xl:row-start-1",
          )}
          data-testid="profile-studio-canvas"
        >
          {children}
        </main>

        {!previewing ? (
          <aside
            ref={inspectorRef}
            id="profile-studio-inspector"
            className="site-profile-glass-surface col-start-2 row-start-1 max-h-[min(28rem,calc(100dvh-9rem))] w-full min-w-0 overflow-y-auto overscroll-contain rounded-card border border-line bg-surface/90 shadow-inner-soft backdrop-blur-veil focus-visible:outline-2 focus-visible:outline-focus xl:sticky xl:top-[8.25rem] xl:col-start-3 xl:row-start-1 xl:max-h-[calc(100dvh-9rem)] xl:w-auto xl:bg-surface/82"
            aria-label="Profile studio inspector"
            data-testid="profile-studio-inspector"
            tabIndex={-1}
          >
            {inspector}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
