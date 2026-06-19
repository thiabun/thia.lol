import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import { Search } from "lucide-react";
import { getSearchResults } from "../../lib/api";
import { cn } from "../../lib/classNames";
import type { SearchProfileResult } from "../../lib/types";
import { Avatar } from "../ui/Avatar";

type MentionTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value"
> & {
  menuClassName?: string;
  onValueChange: (value: string) => void;
  value: string;
  wrapperClassName?: string;
};

type MentionQuery = {
  end: number;
  query: string;
  start: number;
};

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea(
    {
      className,
      menuClassName,
      onKeyDown,
      onValueChange,
      value,
      wrapperClassName,
      ...textareaProps
    },
    forwardedRef,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [query, setQuery] = useState<MentionQuery | undefined>();
    const [suggestions, setSuggestions] = useState<SearchProfileResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeSuggestion = suggestions[activeIndex];

    useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement);

    useEffect(() => {
      if (!query || query.query.length < 2) {
        setSuggestions([]);
        setLoading(false);
        return undefined;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => {
        setLoading(true);
        getSearchResults(query.query)
          .then((result) => {
            if (!controller.signal.aborted) {
              setSuggestions(result.results.profiles.slice(0, 5));
              setActiveIndex(0);
            }
          })
          .catch(() => {
            if (!controller.signal.aborted) {
              setSuggestions([]);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) {
              setLoading(false);
            }
          });
      }, 180);

      return () => {
        controller.abort();
        window.clearTimeout(timeout);
      };
    }, [query]);

    const open = Boolean(query && (loading || suggestions.length > 0));
    const menuId = useMemo(
      () => `mention-menu-${Math.random().toString(36).slice(2)}`,
      [],
    );

    function handleValueChange(nextValue: string, selectionStart: number | null) {
      onValueChange(nextValue);
      setQuery(selectionStart === null ? undefined : mentionQueryAt(nextValue, selectionStart));
    }

    function insertMention(suggestion: SearchProfileResult) {
      if (!query) {
        return;
      }

      const mention = `@${suggestion.user.handle} `;
      const nextValue = `${value.slice(0, query.start)}${mention}${value.slice(query.end)}`;
      const cursor = query.start + mention.length;

      onValueChange(nextValue);
      setQuery(undefined);
      setSuggestions([]);

      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(cursor, cursor);
      });
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (open && suggestions.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveIndex((current) => (current + 1) % suggestions.length);
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex((current) =>
            current === 0 ? suggestions.length - 1 : current - 1,
          );
          return;
        }

        if ((event.key === "Enter" || event.key === "Tab") && activeSuggestion) {
          event.preventDefault();
          insertMention(activeSuggestion);
          return;
        }
      }

      if (event.key === "Escape" && open) {
        event.preventDefault();
        setQuery(undefined);
        setSuggestions([]);
        return;
      }

      onKeyDown?.(event);
    }

    return (
      <span className={cn("relative block", wrapperClassName)}>
        <textarea
          {...textareaProps}
          ref={textareaRef}
          className={className}
          value={value}
          aria-autocomplete="list"
          aria-controls={open ? menuId : undefined}
          onChange={(event) =>
            handleValueChange(
              event.currentTarget.value,
              event.currentTarget.selectionStart,
            )
          }
          onClick={(event) =>
            setQuery(
              mentionQueryAt(
                event.currentTarget.value,
                event.currentTarget.selectionStart,
              ),
            )
          }
          onKeyDown={handleKeyDown}
          onSelect={(event) =>
            setQuery(
              mentionQueryAt(
                event.currentTarget.value,
                event.currentTarget.selectionStart,
              ),
            )
          }
        />
        {open ? (
          <span
            id={menuId}
            role="listbox"
            className={cn(
              "absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-card border border-line bg-surface shadow-lift",
              menuClassName,
            )}
            data-testid="mention-suggestions"
          >
            {loading && suggestions.length === 0 ? (
              <span className="flex min-h-11 items-center gap-2 px-3 text-sm text-muted">
                <Search aria-hidden="true" size={15} />
                Searching
              </span>
            ) : null}
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.user.handle}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm transition duration-fluid ease-fluid hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus",
                  index === activeIndex ? "bg-surface-strong" : null,
                )}
                data-testid={`mention-suggestion-${suggestion.user.handle}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(suggestion);
                }}
              >
                <Avatar user={suggestion.user} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-text">
                    {suggestion.user.displayName}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    @{suggestion.user.handle}
                  </span>
                </span>
              </button>
            ))}
          </span>
        ) : null}
      </span>
    );
  },
);

function mentionQueryAt(value: string, cursor: number): MentionQuery | undefined {
  const before = value.slice(0, cursor);
  const match = /(^|[\s([{])@([A-Za-z0-9_-]{1,40})$/.exec(before);

  if (!match) {
    return undefined;
  }

  const prefix = match[1] ?? "";
  const query = match[2] ?? "";
  const start = before.length - query.length - 1;

  if (prefix === "" || before[start - 1] === prefix) {
    return { start, end: cursor, query };
  }

  return undefined;
}
