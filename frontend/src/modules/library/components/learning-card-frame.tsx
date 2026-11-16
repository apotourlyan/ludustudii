import type { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";
import type { ReactNode } from "react";

import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";

export interface LearningCardFrameProps {
  title: ReactNode;
  actions?: ReactNode;
  // The body.
  children: ReactNode;
  footer?: ReactNode;
  // Lets a parent place the frame, for example as a subgrid item.
  className?: string;
  // Replaces the root element, as base-ui's render prop does, so that a
  // mode's own element, such as the editor's <form>, is the frame itself
  // rather than a wrapper around it.
  render?: useRender.ComponentProps<"div">["render"];
}

// The layout every mode of a learning card shares: a header with the title
// and actions, a separator, the body, and a footer if given. Layout only;
// each mode is its own component and fills the slots.
export function LearningCardFrame({
  title,
  actions,
  children,
  footer,
  className,
  render,
}: LearningCardFrameProps) {
  return (
    <Card render={render} className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle className="min-w-0 wrap-break-word">{title}</CardTitle>
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <Separator />
      <CardContent className="min-w-0 wrap-break-word">{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
