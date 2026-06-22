import {
  Bold,
  Code2,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { cn } from "../../lib/classNames";
import type { RichTextEntity } from "../../lib/types";
import { MentionTextarea } from "./MentionTextarea";
import { RichText } from "./RichText";

type MarkdownEditorProps = {
  className?: string;
  disabled?: boolean;
  entities?: RichTextEntity[] | undefined;
  label?: string;
  maxLength?: number;
  onValueChange: (value: string) => void;
  placeholder?: string;
  textareaTestId?: string;
  value: string;
};

const markdownActions = [
  { id: "heading", label: "Heading", icon: Heading2 },
  { id: "bold", label: "Bold", icon: Bold },
  { id: "italic", label: "Italic", icon: Italic },
  { id: "link", label: "Link", icon: LinkIcon },
  { id: "unordered-list", label: "Bullet list", icon: List },
  { id: "ordered-list", label: "Numbered list", icon: ListOrdered },
  { id: "quote", label: "Quote", icon: Quote },
  { id: "inline-code", label: "Inline code", icon: Code2 },
  { id: "code-block", label: "Code block", icon: Code2 },
  { id: "divider", label: "Divider", icon: Minus },
] as const;

type MarkdownAction = (typeof markdownActions)[number]["id"];

export function MarkdownEditor({
  className,
  disabled = false,
  entities,
  label = "Text",
  maxLength = 2000,
  onValueChange,
  placeholder = "Write with Markdown, @mentions, and HTTPS links.",
  textareaTestId = "profile-markdown-body",
  value,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const remaining = maxLength - value.length;
  const countText = useMemo(
    () => `${value.length}/${maxLength}`,
    [maxLength, value.length],
  );

  function applyAction(action: MarkdownAction) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const insertion = markdownInsertion(action, value, start, end, selected);
    const nextValue = `${value.slice(0, insertion.start)}${insertion.text}${value.slice(insertion.end)}`;
    const boundedValue = nextValue.slice(0, maxLength);
    const cursor = Math.min(insertion.cursor, boundedValue.length);

    onValueChange(boundedValue);

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div
      className={cn("space-y-2", className)}
      data-testid="profile-markdown-editor"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-muted">{label}</span>
        <span
          className={cn(
            "text-xs font-semibold",
            remaining < 0 ? "text-rose-ink" : "text-muted",
          )}
        >
          {countText}
        </span>
      </div>
      <div
        className="flex flex-wrap gap-1 rounded-card border border-line bg-canvas/38 p-1"
        data-testid="profile-markdown-toolbar"
      >
        {markdownActions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.id}
              type="button"
              className="grid size-8 place-items-center rounded-control text-muted transition duration-fluid ease-fluid hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
              title={action.label}
              aria-label={action.label}
              disabled={disabled}
              data-testid={`profile-markdown-button-${action.id}`}
              onClick={() => applyAction(action.id)}
            >
              <Icon aria-hidden="true" size={15} />
            </button>
          );
        })}
        <button
          type="button"
          className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-control bg-accent-soft px-2 text-xs font-semibold text-accent-strong transition duration-fluid ease-fluid hover:bg-accent-soft/80 focus-visible:outline-2 focus-visible:outline-focus"
          disabled={disabled}
          data-testid="profile-markdown-button-preview"
          onClick={() => previewRef.current?.focus()}
        >
          Preview
        </button>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <MentionTextarea
          ref={textareaRef}
          className="min-h-36 w-full resize-y rounded-control border border-line bg-canvas/45 px-3 py-2 font-mono text-sm leading-6 text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          aria-label={label}
          disabled={disabled}
          data-testid={textareaTestId}
          onValueChange={onValueChange}
        />
        <div
          ref={previewRef}
          tabIndex={-1}
          className="min-h-36 rounded-control border border-line bg-canvas/45 p-3 outline-none transition focus:outline-2 focus:outline-focus"
          data-testid="profile-markdown-preview"
        >
          {value.trim() ? (
            <RichText
              markdown
              text={value}
              entities={entities}
              className="space-y-2 break-words text-sm leading-6 text-muted"
            />
          ) : (
            <p className="text-sm text-muted">Preview appears here.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function markdownInsertion(
  action: Exclude<MarkdownAction, "preview">,
  value: string,
  start: number,
  end: number,
  selected: string,
): { cursor: number; end: number; start: number; text: string } {
  if (action === "heading") {
    return linePrefixInsertion(value, start, end, "## ");
  }

  if (action === "unordered-list") {
    return linePrefixInsertion(value, start, end, "- ");
  }

  if (action === "ordered-list") {
    return numberedListInsertion(value, start, end);
  }

  if (action === "quote") {
    return linePrefixInsertion(value, start, end, "> ");
  }

  if (action === "divider") {
    const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const suffix = value[end] && value[end] !== "\n" ? "\n" : "";
    const text = `${prefix}---\n${suffix}`;

    return {
      start,
      end,
      text,
      cursor: start + text.length,
    };
  }

  if (action === "link") {
    const selectedUrl = selected.trim().startsWith("https://")
      ? selected.trim()
      : "https://example.com";
    const label = selected && !selected.trim().startsWith("https://")
      ? selected
      : "Link text";
    const text = `[${label}](${selectedUrl})`;

    return {
      start,
      end,
      text,
      cursor: start + text.length,
    };
  }

  if (action === "inline-code") {
    return wrappedInsertion(start, end, selected, "`", "`", "code");
  }

  if (action === "code-block") {
    const content = selected || "code";
    const text = `\`\`\`\n${content}\n\`\`\``;

    return {
      start,
      end,
      text,
      cursor: start + text.length,
    };
  }

  if (action === "bold") {
    return wrappedInsertion(start, end, selected, "**", "**", "bold text");
  }

  if (action === "italic") {
    return wrappedInsertion(start, end, selected, "*", "*", "italic text");
  }

  return {
    start,
    end,
    text: selected,
    cursor: start + selected.length,
  };
}

function wrappedInsertion(
  start: number,
  end: number,
  selected: string,
  before: string,
  after: string,
  fallback: string,
) {
  const content = selected || fallback;
  const text = `${before}${content}${after}`;

  return {
    start,
    end,
    text,
    cursor: start + before.length + content.length,
  };
}

function linePrefixInsertion(
  value: string,
  start: number,
  end: number,
  prefix: string,
) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = nextLineEnd(value, end);
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const text = lines
    .map((line) => (line.trim() ? `${prefix}${line}` : prefix.trimEnd()))
    .join("\n");

  return {
    start: lineStart,
    end: lineEnd,
    text,
    cursor: lineStart + text.length,
  };
}

function numberedListInsertion(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = nextLineEnd(value, end);
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const text = lines
    .map((line, index) => `${index + 1}. ${line || "List item"}`)
    .join("\n");

  return {
    start: lineStart,
    end: lineEnd,
    text,
    cursor: lineStart + text.length,
  };
}

function nextLineEnd(value: string, index: number): number {
  const nextBreak = value.indexOf("\n", index);

  return nextBreak === -1 ? value.length : nextBreak;
}
