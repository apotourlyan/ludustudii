import Markdown, { type Components } from "react-markdown";

import { Separator } from "@/shared/ui/separator";

// Tailwind preflight resets element styles, so markdown elements are styled here
const markdownComponents: Components = {
  h1: ({ node: _node, children, ...props }) => (
    <h1 className="mt-4 mb-2 text-lg font-semibold first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ node: _node, children, ...props }) => (
    <h2 className="mt-4 mb-2 text-base font-semibold first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...props}>
      {children}
    </h3>
  ),
  h4: ({ node: _node, children, ...props }) => (
    <h4 className="mt-3 mb-1 font-semibold first:mt-0" {...props}>
      {children}
    </h4>
  ),
  p: ({ node: _node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  a: ({ node: _node, children, ...props }) => (
    <a className="text-primary underline underline-offset-2" {...props}>
      {children}
    </a>
  ),
  ul: ({ node: _node, ...props }) => <ul className="my-2 list-disc pl-5" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="my-2 list-decimal pl-5" {...props} />,
  li: ({ node: _node, ...props }) => <li className="my-0.5" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground" {...props} />
  ),
  code: ({ node: _node, ...props }) => (
    <code className="bg-muted px-1 py-0.5 font-mono" {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre className="my-2 overflow-x-auto bg-muted p-3 font-mono [&>code]:p-0" {...props} />
  ),
  hr: () => <Separator className="my-4" />,
};

// A card's title or description, rendered from its Markdown.
export function CardMarkdown({ children }: { children: string }) {
  return <Markdown components={markdownComponents}>{children}</Markdown>;
}
