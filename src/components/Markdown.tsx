'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import { type ComponentProps } from 'react'

/**
 * Project-wide markdown renderer.
 *
 * Why this exists:
 *   Earlier in the project both /blog/[slug] and /notes/[slug] used a
 *   hand-rolled regex-based "render paragraphs as one of h1/h2/code/img/p"
 *   splitter. That broke on:
 *     - Windows CRLF (single mega-paragraph)
 *     - `![](url)` images sharing a paragraph with surrounding text
 *     - any future Markdown construct the regex didn't anticipate
 *   We now use react-markdown, which handles every real-world Markdown
 *   construct (including GFM tables, autolinks, strikethrough, inline
 *   images, and CRLF/LF line endings) and matches the same look we
 *   already shipped via the hand-rolled splitter.
 *
 * The hand-rolled splitter lives on in /admin for the post editor (it
 * does structural checks, not rendering) — see PostEditor.tsx.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeSlug]}
      components={{
        // Force <a> to open in a new tab for external links. We detect
        // "external" by absolute URL — anything starting with http(s)://
        // or //. Relative links stay in-tab.
        a({ href, children, ...rest }: ComponentProps<'a'>) {
          const isExternal = !!href && /^(https?:)?\/\//.test(href)
          return (
            <a
              href={href}
              {...(isExternal
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              {...rest}
            >
              {children}
            </a>
          )
        },
        // Image: rounded-lg + lazy loading, matching the previous
        // <figure><img class="rounded-lg …"></figure> styling.
        img({ src, alt, title }) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ''}
              title={title}
              className="rounded-lg w-full h-auto my-6"
              loading="lazy"
            />
          )
        },
        // Heading sizes match the project typography scale
        // (font-serif + the 2xl/3xl/4xl utility classes).
        h1: ({ children, ...rest }) => (
          <h1
            {...rest}
            className="font-serif text-3xl font-medium mt-12 mb-6"
          >
            {children}
          </h1>
        ),
        h2: ({ children, ...rest }) => (
          <h2
            {...rest}
            className="font-serif text-2xl font-medium mt-10 mb-4"
          >
            {children}
          </h2>
        ),
        p: ({ children, ...rest }) => (
          <p {...rest} className="my-5 leading-relaxed">
            {children}
          </p>
        ),
        code: ({ children, className, ...rest }: ComponentProps<'code'> & { className?: string }) => {
          // rehype-highlight adds a className like "language-ts" for
          // fenced code blocks. Inline code (single backticks) has no
          // class. Style both.
          const isBlock = !!className && /language-/.test(className)
          if (isBlock) {
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            )
          }
          return (
            <code
              className="bg-[var(--muted)] rounded px-1.5 py-0.5 text-sm font-mono"
              {...rest}
            >
              {children}
            </code>
          )
        },
        pre: ({ children, ...rest }) => (
          <pre
            {...rest}
            className="bg-[var(--muted)] rounded-lg p-4 my-6 overflow-x-auto text-sm font-mono"
          >
            {children}
          </pre>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
