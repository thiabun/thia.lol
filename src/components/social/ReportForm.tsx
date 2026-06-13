import { useState, type FormEvent } from "react";
import { Flag } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../ui/Button";
import { SelectField, TextareaField } from "../ui/Field";
import { createReport, type ReportCategory, type ReportTargetType } from "../../lib/api";
import { cn } from "../../lib/classNames";
import { useAuth } from "../../lib/useAuth";

type ReportFormProps = {
  targetType: ReportTargetType;
  targetId: number;
  title: string;
  explainer: string;
  disabled?: boolean;
  postId?: number;
  reportedUserId?: number | undefined;
  triggerMode?: "text" | "icon";
  triggerLabel?: string;
  triggerSize?: "default" | "compact";
  triggerClassName?: string;
  triggerIconSize?: number;
  className?: string;
  feedbackClassName?: string;
  formClassName?: string;
};

export function ReportForm({
  className,
  disabled = false,
  explainer,
  feedbackClassName,
  formClassName,
  postId,
  reportedUserId,
  targetId,
  targetType,
  title,
  triggerClassName,
  triggerIconSize,
  triggerMode = "text",
  triggerLabel = "Report",
  triggerSize = "default",
}: ReportFormProps) {
  const { runWithAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("harassment");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDetails = details.trim();
    setPending(true);
    setError(undefined);
    setMessage(undefined);

    try {
      await runWithAuth((freshCsrfToken) =>
        createReport(
          {
            targetType,
            targetId,
            category,
            ...(trimmedDetails ? { details: trimmedDetails } : {}),
            ...(postId !== undefined ? { postId } : {}),
            ...(reportedUserId !== undefined ? { reportedUserId } : {}),
          },
          freshCsrfToken,
        ),
      );
      setMessage("Report sent.");
      setDetails("");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create report.");
    } finally {
      setPending(false);
    }
  }

  const iconTrigger = triggerMode === "icon";
  const compactIconTrigger = iconTrigger && triggerSize === "compact";

  return (
    <div className={className}>
      <Button
        type="button"
        variant="ghost"
        size={compactIconTrigger ? "sm" : iconTrigger ? "icon" : "sm"}
        aria-label={iconTrigger ? triggerLabel : undefined}
        title={iconTrigger ? triggerLabel : undefined}
        className={cn(
          iconTrigger
            ? compactIconTrigger
              ? "min-h-0 size-7 rounded-full px-0 text-muted"
              : "rounded-full text-muted"
            : undefined,
          triggerClassName,
        )}
        disabled={disabled || pending}
        icon={
          <Flag
            aria-hidden="true"
            size={triggerIconSize ?? (compactIconTrigger ? 13 : 15)}
          />
        }
        onClick={() => {
          setError(undefined);
          setMessage(undefined);
          setOpen((current) => !current);
        }}
      >
        {iconTrigger ? null : triggerLabel}
      </Button>
      {message ? (
        <p className={cn("mt-2 text-xs font-medium text-leaf-ink", feedbackClassName)}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p className={cn("mt-2 text-xs font-medium text-rose-ink", feedbackClassName)}>
          {error}
        </p>
      ) : null}
      {open ? (
        <form
          className={cn(
            "mt-3 space-y-3 rounded-card border border-line bg-canvas/45 p-3",
            formClassName,
          )}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="text-xs leading-5 text-muted">
            {explainer} Reports are reviewed against the{" "}
            <Link
              to="/community-guidelines"
              className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
            >
              Community Guidelines
            </Link>
            . The{" "}
            <Link
              to="/moderation"
              className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
            >
              Moderation Policy
            </Link>{" "}
            explains possible actions.
            {category === "copyright" ? (
              <>
                {" "}
                For rights concerns, see the{" "}
                <Link
                  to="/copyright"
                  className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
                >
                  Copyright Policy
                </Link>
                .
              </>
            ) : null}
          </p>
          <SelectField
            id={`report-category-${targetType}-${targetId}`}
            label="What's wrong?"
            value={category}
            options={reportCategoryOptions}
            onChange={(event) => setCategory(event.target.value as ReportCategory)}
          />
          <TextareaField
            id={`report-details-${targetType}-${targetId}`}
            label="Add details"
            rows={3}
            maxLength={2000}
            value={details}
            placeholder="Optional context for moderators"
            onChange={(event) => setDetails(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              Report
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

const reportCategoryOptions: Array<{ value: ReportCategory; label: string }> = [
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate or abuse" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "non_consensual_content", label: "Non-consensual content" },
  { value: "private_info", label: "Private information" },
  { value: "spam_or_scam", label: "Spam or scam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "copyright", label: "Copyright" },
  { value: "violence_or_threats", label: "Violence or threats" },
  { value: "self_harm", label: "Self-harm" },
  { value: "illegal_content", label: "Illegal content" },
  { value: "other", label: "Other" },
];
