"use client";

import Markdown from "react-markdown";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 text-sm leading-relaxed text-inherit last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-inherit last:mb-0 [&_ul]:mt-1 [&_ul]:list-[circle] [&_ul]:pl-4">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-inherit last:mb-0 [&_ol]:mt-1">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed text-inherit [&>p]:mb-1 [&>p]:last:mb-0">
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-base font-semibold text-gray-900 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-sm font-semibold text-gray-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-3 text-sm font-semibold text-gray-900 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold text-gray-900 first:mt-0">
      {children}
    </h4>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary-100 underline underline-offset-2 hover:text-primary-dark"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-gray-300 pl-3 text-inherit italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
  code: ({ className, children, ...props }) => {
    const isFenced = Boolean(className?.startsWith("language-"));
    if (isFenced) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.8125rem] text-gray-800"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 max-w-full overflow-x-auto rounded-md bg-gray-100 p-3 font-mono text-xs text-gray-800">
      {children}
    </pre>
  ),
};

interface NoteMarkdownProps {
  markdown: string;
  className?: string;
}

const NoteMarkdown = ({ markdown, className }: NoteMarkdownProps) => {
  if (!markdown?.trim()) {
    return null;
  }

  return (
    <div
      className={`w-full max-w-none text-sm leading-relaxed [&_*]:break-words ${className ?? "text-gray-600"}`}
    >
      <Markdown components={markdownComponents}>{markdown}</Markdown>
    </div>
  );
};

export default NoteMarkdown;
