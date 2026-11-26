import { cn } from "cn";
import Markdown, { type Components } from "react-markdown";

import { Separator } from "@/shared/ui/separator";

// Tailwind preflight resets element styles, so markdown elements are styled
// here. The inline elements, which a title renders too.
const inlineComponents = {
  a: ({ node: _node, children, ...props }) => (
    <a className="text-primary underline underline-offset-2" {...props}>
      {children}
    </a>
  ),
  // Bold keeps preflight's bolder weight and gains a dotted underline in the
  // muted color. A text underline, not a border: it stays inside the line
  // box, so a title that truncate or line-clamp clips keeps it.
  strong: ({ node: _node, ...props }) => (
    <strong
      className="underline decoration-muted-foreground decoration-dotted underline-offset-4"
      {...props}
    />
  ),
  // Merges a fenced block's language-* class instead of losing the style to it.
  code: ({ node: _node, className, ...props }) => (
    <code className={cn("bg-muted px-1 py-0.5 font-mono", className)} {...props} />
  ),
} satisfies Components;

// A description's headings render one level below their Markdown level, so
// the page's own <h1> stays the only one: "#" is an <h2>, "##" an <h3>, and
// so on, with "#####" and "######" both an <h6>. Each keeps the look of its
// Markdown level; levels 5 and 6 have no style of their own.
const descriptionComponents: Components = {
  ...inlineComponents,
  h1: ({ node: _node, children, ...props }) => (
    <h2 className="mt-4 mb-2 text-lg font-semibold first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h2: ({ node: _node, children, ...props }) => (
    <h3 className="mt-4 mb-2 text-base font-semibold first:mt-0" {...props}>
      {children}
    </h3>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h4 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...props}>
      {children}
    </h4>
  ),
  h4: ({ node: _node, children, ...props }) => (
    <h5 className="mt-3 mb-1 font-semibold first:mt-0" {...props}>
      {children}
    </h5>
  ),
  h5: ({ node: _node, children, ...props }) => <h6 {...props}>{children}</h6>,
  h6: ({ node: _node, children, ...props }) => <h6 {...props}>{children}</h6>,
  p: ({ node: _node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  ul: ({ node: _node, ...props }) => <ul className="my-2 list-disc pl-5" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="my-2 list-decimal pl-5" {...props} />,
  li: ({ node: _node, ...props }) => <li className="my-0.5" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground" {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre className="my-2 overflow-x-auto bg-muted p-3 font-mono [&>code]:p-0" {...props} />
  ),
  hr: () => <Separator className="my-4" />,
};

// What a title keeps of its Markdown: bold, italic, code and links. Every
// other element is unwrapped to its contents, so "# Photosynthesis" reads
// "Photosynthesis", and the title's paragraph adds no <p>. The line breaks
// between unwrapped blocks stay in the text, so two paragraphs or a list's
// items read as one line with a space between them.
const TITLE_ELEMENTS = ["strong", "em", "code", "a"];

// The part of a rendered tree this file looks at.
interface TreeNode {
  type: string;
  value?: string;
  children?: TreeNode[];
}

// Whether the tree has text to show. Raw HTML counts: it renders as text.
function hasText(node: TreeNode): boolean {
  if (node.type === "text" || node.type === "raw") {
    return Boolean(node.value?.trim());
  }
  return node.children?.some(hasText) ?? false;
}

// A title made only of syntax that leaves no text once unwrapped, such as
// "---" or an image, would render as nothing, and on a card's page as an
// empty <h1>. Such a title shows its source instead. Runs before the
// unwrapping, which keeps every text node.
const showSourceWhenEmpty = () => (tree: TreeNode, file: { value: unknown }) => {
  if (!hasText(tree)) {
    tree.children = [{ type: "text", value: String(file.value) }];
  }
};

// A card's title, rendered from its Markdown as inline text, for its parent
// to place in a heading or a block of its own.
export function LearningCardTitleMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      components={inlineComponents}
      allowedElements={TITLE_ELEMENTS}
      unwrapDisallowed
      rehypePlugins={[showSourceWhenEmpty]}
    >
      {children}
    </Markdown>
  );
}

// A card's description, rendered from its Markdown, with its headings one
// level down.
export function LearningCardDescriptionMarkdown({ children }: { children: string }) {
  return <Markdown components={descriptionComponents}>{children}</Markdown>;
}
