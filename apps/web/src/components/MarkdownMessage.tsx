'use client';

import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Single responsibility: render an assistant chat message as styled markdown.
 *
 * The chat and expand system prompts explicitly ask the model for "plain
 * markdown", so assistant bubbles need a real renderer (code fences, lists,
 * inline code, bold/italic, links). User messages stay plain text and are NOT
 * passed through here.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-message">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

const components: Parameters<typeof ReactMarkdown>[0]['components'] = {
  p: (props) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-ink-900" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  a: (props) => (
    <a
      className="text-accent-600 underline underline-offset-2 hover:text-accent-700"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  h1: (props) => <h3 className="text-base font-semibold mt-3 mb-1" {...props} />,
  h2: (props) => <h3 className="text-base font-semibold mt-3 mb-1" {...props} />,
  h3: (props) => <h3 className="text-sm font-semibold mt-3 mb-1" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="border-l-2 border-ink-300 pl-3 my-2 text-ink-700 italic"
      {...props}
    />
  ),
  hr: () => <hr className="my-3 border-ink-200" />,
  pre: (props) => (
    <pre
      className="my-2 rounded-lg bg-ink-900/90 text-ink-100 text-[12px] leading-relaxed p-3 overflow-x-auto font-mono"
      {...props}
    />
  ),
  code: (props: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) => {
    const { inline, className, children, ...rest } = props;
    if (inline) {
      return (
        <code
          className="rounded px-1 py-0.5 bg-ink-200/70 text-ink-800 font-mono text-[12.5px]"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={`font-mono ${className ?? ''}`} {...rest}>
        {children}
      </code>
    );
  },
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <table className="border-collapse text-[12.5px]" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border border-ink-200 px-2 py-1 bg-ink-100 text-left font-semibold" {...props} />
  ),
  td: (props) => <td className="border border-ink-200 px-2 py-1 align-top" {...props} />,
};
