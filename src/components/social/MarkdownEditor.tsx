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
import {
  forwardRef,
  useMemo,
  useRef,
  type ForwardedRef,
} from "react";
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
  minHeightClassName?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  previewClassName?: string;
  renderedClassName?: string;
  testIdPrefix?: string;
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

export const MarkdownEditor = forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(
  function MarkdownEditor({
    className,
    disabled = false,
    entities,
    label = "Text",
    maxLength = 2000,
    minHeightClassName = "min-h-44",
    onValueChange,
    placeholder = "Write with Markdown, @mentions, and HTTPS links.",
    previewClassName,
    renderedClassName,
    testIdPrefix = "profile-markdown",
    textareaTestId,
    value,
  }: MarkdownEditorProps, forwardedRef) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const remaining = maxLength - value.length;
  const effectiveTextareaTestId = textareaTestId ?? `${testIdPrefix}-body`;
  const countText = useMemo(
    () => `${value.length}/${maxLength}`,
    [maxLength, value.length],
  );

  function setTextareaNode(node: HTMLTextAreaElement | null) {
    textareaRef.current = node;
    assignForwardedRef(forwardedRef, node);
  }

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
      data-testid={`${testIdPrefix}-editor`}
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
        data-testid={`${testIdPrefix}-toolbar`}
      >
        {markdownActions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.id}
              type="button"
              className="grid size-8 place-items-center rounded-full text-muted transition duration-fluid ease-fluid hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
              title={action.label}
              aria-label={action.label}
              disabled={disabled}
              data-testid={`${testIdPrefix}-button-${action.id}`}
              onClick={() => applyAction(action.id)}
            >
              <Icon aria-hidden="true" size={15} />
            </button>
          );
        })}
      </div>
      <div
        className="overflow-hidden rounded-control border border-line bg-canvas/45 transition focus-within:border-line-strong focus-within:outline-2 focus-within:outline-focus"
        data-testid={`${testIdPrefix}-surface`}
      >
        <MentionTextarea
          ref={setTextareaNode}
          wrapperClassName="block"
          className={cn(
            "w-full resize-y border-0 bg-transparent px-3 py-2 text-sm leading-6 text-text caret-accent-strong outline-none placeholder:text-muted/70 selection:bg-accent-soft/65 disabled:opacity-60",
            minHeightClassName,
          )}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          aria-label={label}
          disabled={disabled}
          data-testid={effectiveTextareaTestId}
          onValueChange={onValueChange}
        />
        {value.trim() ? (
          <div
            className={cn(
              "border-t border-line/70 bg-surface/42 px-3 py-2",
              previewClassName,
            )}
            data-testid={`${testIdPrefix}-preview`}
          >
            <RichText
              markdown
              text={value}
              entities={entities}
              className={cn(
                "space-y-2 break-words text-sm leading-6 text-text",
                renderedClassName,
              )}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
});

function assignForwardedRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
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
