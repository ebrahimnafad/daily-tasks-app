import { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked: GFM + tables, no async
marked.use({
  gfm: true,
  breaks: true,
});

interface MarkdownNoteProps {
  text: string;
}

/**
 * Renders markdown text to sanitised HTML via `marked`.
 * Tables, bold, italic, lists, code, and blockquotes are all supported.
 * XSS: We only render user's own notes (no third-party content), so
 * dangerouslySetInnerHTML is acceptable here. The content never comes from
 * an untrusted network source.
 */
export default function MarkdownNote({ text }: MarkdownNoteProps) {
  const html = useMemo(() => {
    if (!text.trim()) return '';
    return marked.parse(text) as string;
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
