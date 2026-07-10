import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/classNames";
import type { RichTextEntity } from "../../lib/types";

type RichTextProps = {
  className?: string;
  entities?: RichTextEntity[] | undefined;
  markdown?: boolean;
  text: string;
};

export function RichText({
  className,
  entities,
  markdown = false,
  text,
}: RichTextProps) {
  const resolvedEntities =
    entities && entities.length > 0 ? entities : fallbackEntities(text);
  const inlineEntities = normalizedInlineEntities(text, resolvedEntities);

  return markdown ? (
    <div className={className} data-testid="profile-markdown-rendered">
      {renderMarkdownRichText(text, inlineEntities)}
    </div>
  ) : (
    <span className={className}>
      {inlineEntities.length === 0
        ? text
        : renderInlineRichText(text, inlineEntities)}
    </span>
  );
}

function renderInlineRichText(text: string, entities: RichTextEntity[]) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  entities.forEach((entity) => {
    const start = Math.max(0, Math.min(text.length, entity.start));
    const end = Math.max(start, Math.min(text.length, entity.start + entity.length));

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    const label = text.slice(start, end) || entity.text;

    nodes.push(renderRichTextEntity(entity, label, `inline:${entity.start}`));

    cursor = end;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function renderRichTextEntity(
  entity: RichTextEntity,
  label: string,
  key: string,
): ReactNode {
  if (entity.type === "mention") {
    return (
      <Link
        key={`mention:${key}:${entity.mention.handle}`}
        to={`/@${entity.mention.handle}`}
        className="font-semibold text-accent-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        data-testid="rich-mention-link"
      >
        {label}
      </Link>
    );
  }

  return (
    <a
      key={`link:${key}:${entity.link.url}`}
      href={entity.link.url}
      rel="noopener noreferrer"
      target="_blank"
      className="font-medium text-accent-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-testid="rich-inline-link"
    >
      {label}
    </a>
  );
}

function renderMarkdownRichText(text: string, entities: RichTextEntity[]) {
  const lines = text.split("\n");
  const lineStarts = markdownLineStarts(lines);
  const blocks: ReactNode[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      lineIndex += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const startLine = lineIndex;
      const codeLines: string[] = [];
      lineIndex += 1;

      while (lineIndex < lines.length) {
        const codeLine = lines[lineIndex] ?? "";

        if (codeLine.trim().startsWith("```")) {
          lineIndex += 1;
          break;
        }

        codeLines.push(codeLine);
        lineIndex += 1;
      }

      blocks.push(
        <pre
          key={`code:${startLine}`}
          className="overflow-x-auto rounded-card border border-line bg-canvas/65 p-3 text-xs leading-5 text-text"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (markdownDividerLine(line)) {
      blocks.push(
        <hr key={`hr:${lineIndex}`} className="border-line/80" />,
      );
      lineIndex += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);

    if (heading) {
      const depth = Math.min(3, heading[1]?.length ?? 1);
      const markerLength = (heading[1]?.length ?? 1) + 1;
      const content = heading[2] ?? "";
      const contentStart = (lineStarts[lineIndex] ?? 0) + markerLength;
      const headingClass = cn(
        "font-semibold leading-tight text-text",
        depth === 1
          ? "text-[1.55em]"
          : depth === 2
            ? "text-[1.35em]"
            : "text-[1.18em]",
      );

      blocks.push(
        depth === 1 ? (
          <h3 key={`heading:${lineIndex}`} className={headingClass}>
            {renderMarkdownInline(content, entities, contentStart, `h:${lineIndex}`)}
          </h3>
        ) : (
          <h4 key={`heading:${lineIndex}`} className={headingClass}>
            {renderMarkdownInline(content, entities, contentStart, `h:${lineIndex}`)}
          </h4>
        ),
      );
      lineIndex += 1;
      continue;
    }

    const quoteMatch = /^>\s?/.exec(line);

    if (quoteMatch) {
      const quoteLines: Array<{ offset: number; text: string }> = [];
      const startLine = lineIndex;

      while (lineIndex < lines.length) {
        const quoteLine = lines[lineIndex] ?? "";
        const marker = /^>\s?/.exec(quoteLine);

        if (!marker) {
          break;
        }

        const markerLength = marker[0].length;
        quoteLines.push({
          offset: (lineStarts[lineIndex] ?? 0) + markerLength,
          text: quoteLine.slice(markerLength),
        });
        lineIndex += 1;
      }

      blocks.push(
        <blockquote
          key={`quote:${startLine}`}
          className="border-l-2 border-line-strong pl-3 text-muted"
        >
          {renderMarkdownLineGroup(quoteLines, entities, `quote:${startLine}`)}
        </blockquote>,
      );
      continue;
    }

    const listMatch = markdownListMatch(line);

    if (listMatch) {
      const startLine = lineIndex;
      const ordered = listMatch.ordered;
      const items: Array<{ offset: number; text: string }> = [];

      while (lineIndex < lines.length) {
        const itemLine = lines[lineIndex] ?? "";
        const itemMatch = markdownListMatch(itemLine);

        if (!itemMatch || itemMatch.ordered !== ordered) {
          break;
        }

        items.push({
          offset: (lineStarts[lineIndex] ?? 0) + itemMatch.markerLength,
          text: itemLine.slice(itemMatch.markerLength),
        });
        lineIndex += 1;
      }

      const ListTag = ordered ? "ol" : "ul";

      blocks.push(
        <ListTag
          key={`list:${startLine}`}
          className={cn(
            "ml-5 space-y-1",
            ordered ? "list-decimal" : "list-disc",
          )}
        >
          {items.map((item, itemIndex) => (
            <li key={`li:${startLine}:${itemIndex}`} className="pl-1">
              {renderMarkdownInline(
                item.text,
                entities,
                item.offset,
                `li:${startLine}:${itemIndex}`,
              )}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const startLine = lineIndex;
    const paragraphLines: string[] = [];

    while (lineIndex < lines.length) {
      const paragraphLine = lines[lineIndex] ?? "";

      if (paragraphLine.trim() === "" || markdownSpecialLine(paragraphLine)) {
        break;
      }

      paragraphLines.push(paragraphLine);
      lineIndex += 1;
    }

    if (paragraphLines.length === 0) {
      blocks.push(
        <p key={`p:${startLine}`} className="min-w-0 break-words">
          {renderMarkdownInline(
            line,
            entities,
            lineStarts[startLine] ?? 0,
            `p:${startLine}`,
          )}
        </p>,
      );
      lineIndex += 1;
      continue;
    }

    blocks.push(
      <p key={`p:${startLine}`} className="min-w-0 break-words">
        {renderMarkdownInlineWithBreaks(
          paragraphLines.join("\n"),
          entities,
          lineStarts[startLine] ?? 0,
          `p:${startLine}`,
        )}
      </p>,
    );
  }

  return blocks.length > 0 ? blocks : null;
}

function renderMarkdownInlineWithBreaks(
  text: string,
  entities: RichTextEntity[],
  baseOffset: number,
  keyPrefix: string,
) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  text.split("\n").forEach((line, index, parts) => {
    nodes.push(
      ...renderMarkdownInline(
        line,
        entities,
        baseOffset + cursor,
        `${keyPrefix}:line:${index}`,
      ),
    );
    cursor += line.length + 1;

    if (index < parts.length - 1) {
      nodes.push(<br key={`${keyPrefix}:br:${index}`} />);
    }
  });

  return nodes;
}

function renderMarkdownLineGroup(
  lines: Array<{ offset: number; text: string }>,
  entities: RichTextEntity[],
  keyPrefix: string,
) {
  const nodes: ReactNode[] = [];

  lines.forEach((line, index) => {
    nodes.push(
      ...renderMarkdownInline(
        line.text,
        entities,
        line.offset,
        `${keyPrefix}:line:${index}`,
      ),
    );

    if (index < lines.length - 1) {
      nodes.push(<br key={`${keyPrefix}:br:${index}`} />);
    }
  });

  return nodes;
}

function renderMarkdownInline(
  text: string,
  entities: RichTextEntity[],
  baseOffset: number,
  keyPrefix: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const entityByStart = new Map<number, RichTextEntity>();

  entities.forEach((entity) => {
    entityByStart.set(entity.start, entity);
  });

  let index = 0;

  while (index < text.length) {
    const globalOffset = baseOffset + index;
    const markdownLink = markdownLinkAt(text, index);

    if (markdownLink) {
      nodes.push(
        <a
          key={`${keyPrefix}:mdlink:${index}`}
          href={markdownLink.url}
          rel="noopener noreferrer"
          target="_blank"
          className="font-medium text-accent-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          data-testid="rich-inline-link"
        >
          {markdownLink.label}
        </a>,
      );
      index += markdownLink.length;
      continue;
    }

    const code = markdownDelimitedAt(text, index, "`", "`");

    if (code) {
      nodes.push(
        <code
          key={`${keyPrefix}:code:${index}`}
          className="rounded-control bg-canvas/70 px-1.5 py-0.5 text-[0.92em] font-semibold text-text"
        >
          {code.content}
        </code>,
      );
      index += code.length;
      continue;
    }

    const bold =
      markdownDelimitedAt(text, index, "**", "**") ??
      markdownDelimitedAt(text, index, "__", "__");

    if (bold) {
      nodes.push(
        <strong key={`${keyPrefix}:bold:${index}`} className="font-semibold text-text">
          {renderMarkdownInline(
            bold.content,
            entities,
            globalOffset + bold.openLength,
            `${keyPrefix}:bold:${index}`,
          )}
        </strong>,
      );
      index += bold.length;
      continue;
    }

    const italic = markdownDelimitedAt(text, index, "*", "*");

    if (italic) {
      nodes.push(
        <em key={`${keyPrefix}:italic:${index}`} className="text-text">
          {renderMarkdownInline(
            italic.content,
            entities,
            globalOffset + italic.openLength,
            `${keyPrefix}:italic:${index}`,
          )}
        </em>,
      );
      index += italic.length;
      continue;
    }

    const entity = entityByStart.get(globalOffset);

    if (entity && globalOffset + entity.length <= baseOffset + text.length) {
      const label = text.slice(index, index + entity.length) || entity.text;
      nodes.push(renderRichTextEntity(entity, label, `${keyPrefix}:${index}`));
      index += entity.length;
      continue;
    }

    nodes.push(text[index]);
    index += 1;
  }

  return nodes;
}

function markdownLineStarts(lines: string[]): number[] {
  const starts: number[] = [];
  let offset = 0;

  lines.forEach((line) => {
    starts.push(offset);
    offset += line.length + 1;
  });

  return starts;
}

function markdownSpecialLine(line: string): boolean {
  return (
    line.trim().startsWith("```") ||
    markdownDividerLine(line) ||
    /^(#{1,3})\s+/.test(line) ||
    /^>\s?/.test(line) ||
    markdownListMatch(line) !== undefined
  );
}

function markdownDividerLine(line: string): boolean {
  return /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

function markdownListMatch(
  line: string,
): { markerLength: number; ordered: boolean } | undefined {
  const unordered = /^(\s{0,3}[-*+]\s+)/.exec(line);

  if (unordered) {
    return { markerLength: unordered[1]?.length ?? 0, ordered: false };
  }

  const ordered = /^(\s{0,3}\d+[.)]\s+)/.exec(line);

  if (ordered) {
    return { markerLength: ordered[1]?.length ?? 0, ordered: true };
  }

  return undefined;
}

function markdownLinkAt(
  text: string,
  index: number,
): { label: string; length: number; url: string } | undefined {
  if (text[index] !== "[") {
    return undefined;
  }

  const match = /^\[([^\]\n]{1,200})\]\((https:\/\/[^\s<>"']+)\)/i.exec(
    text.slice(index),
  );

  if (!match) {
    return undefined;
  }

  const label = match[1] ?? "";
  const rawUrl = trimUrlToken(match[2] ?? "");
  const url = safeHttpsUrl(rawUrl);

  if (!label.trim() || !url) {
    return undefined;
  }

  return {
    label,
    length: match[0].length,
    url,
  };
}

function markdownDelimitedAt(
  text: string,
  index: number,
  open: string,
  close: string,
): { content: string; length: number; openLength: number } | undefined {
  if (!text.startsWith(open, index)) {
    return undefined;
  }

  if (open === "*" && text.startsWith("**", index)) {
    return undefined;
  }

  const contentStart = index + open.length;
  const closeIndex = text.indexOf(close, contentStart);

  if (closeIndex <= contentStart) {
    return undefined;
  }

  return {
    content: text.slice(contentStart, closeIndex),
    length: closeIndex + close.length - index,
    openLength: open.length,
  };
}

function normalizedInlineEntities(
  text: string,
  entities: RichTextEntity[],
): RichTextEntity[] {
  const result: RichTextEntity[] = [];
  let cursor = 0;

  [...entities]
    .sort((first, second) => first.start - second.start)
    .forEach((entity) => {
      const start = entity.start;
      const end = entity.start + entity.length;

      if (start < cursor || start < 0 || end > text.length) {
        return;
      }

      result.push(entity);
      cursor = end;
    });

  return result;
}

function fallbackEntities(text: string): RichTextEntity[] {
  const entities: RichTextEntity[] = [];
  const occupied: Array<{ start: number; end: number }> = [];
  const linkPattern = /https:\/\/[^\s<>"']+/gi;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkPattern.exec(text)) !== null) {
    const raw = trimUrlToken(linkMatch[0]);
    const url = safeHttpsUrl(raw);

    if (!url) {
      continue;
    }

    const start = linkMatch.index;
    const length = raw.length;
    occupied.push({ start, end: start + length });
    entities.push({
      type: "link",
      start,
      length,
      text: raw,
      link: { url },
    });
  }

  const mentionPattern = /(^|[^A-Za-z0-9_])@([A-Za-z0-9][A-Za-z0-9_-]{1,38}[A-Za-z0-9])/g;
  let mentionMatch: RegExpExecArray | null;

  while ((mentionMatch = mentionPattern.exec(text)) !== null) {
    const prefix = mentionMatch[1] ?? "";
    const handle = (mentionMatch[2] ?? "").toLowerCase();
    const start = mentionMatch.index + prefix.length;
    const mentionText = `@${handle}`;

    if (
      occupied.some((range) => start < range.end && start + mentionText.length > range.start)
    ) {
      continue;
    }

    entities.push({
      type: "mention",
      start,
      length: mentionText.length,
      text: mentionText,
      mention: {
        handle,
        user: {
          id: 0,
          handle,
          displayName: handle,
          initials: handle.slice(0, 2).toUpperCase(),
          aura: "frost",
          avatarUrl: null,
        },
      },
    });
  }

  return entities.sort((first, second) => first.start - second.start);
}

function trimUrlToken(value: string): string {
  let trimmed = value.replace(/[.,!?;:]+$/g, "");

  while (/[)\]}]$/.test(trimmed)) {
    const close = trimmed.at(-1);
    const open = close === ")" ? "(" : close === "]" ? "[" : "{";

    if (count(trimmed, open) >= count(trimmed, close ?? "")) {
      break;
    }

    trimmed = trimmed.slice(0, -1);
  }

  return trimmed;
}

function count(value: string, token: string): number {
  return token ? value.split(token).length - 1 : 0;
}

function safeHttpsUrl(value: string): string | undefined {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" || url.username || url.password) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}
