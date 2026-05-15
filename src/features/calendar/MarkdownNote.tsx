import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';

// Configure marked: GFM + tables, no async
marked.use({
  gfm: true,
  breaks: true,
});

// M-8: Tight allow-list — only safe formatting/structural elements.
// All script tags, event handlers, javascript: URIs, and data: URIs
// are stripped by DOMPurify before the HTML reaches the DOM.
const PURIFY_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'del',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'code',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'hr',
    'span',
    'div',
    'a',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  // Force all links to be safe: strip javascript: and data: schemes
  FORCE_BODY: true,
};

interface MarkdownNoteProps {
  text: string;
}

/**
 * Renders markdown text to sanitised HTML.
 * Pipeline: text → marked.parse() → DOMPurify.sanitize() → dangerouslySetInnerHTML.
 * DOMPurify strips all script tags, event-handler attributes, and non-http(s)
 * URI schemes before the HTML is inserted into the DOM.
 */
export default function MarkdownNote({ text }: MarkdownNoteProps) {
  const html = useMemo(() => {
    if (!text.trim()) return '';
    const raw = marked.parse(text) as string;
    // M-8: Sanitize — double-cast required: sanitize() returns TrustedHTML|string
    return DOMPurify.sanitize(raw, PURIFY_CONFIG) as unknown as string;
  }, [text]);

  if (!html) {
    return (
      <span style={{ color: 'rgba(var(--gold-rgb), 0.3)', fontSize: 'var(--font-sm)' }}>
        لا يوجد محتوى...
      </span>
    );
  }

  return (
    <div
      className="cal-note-body"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
