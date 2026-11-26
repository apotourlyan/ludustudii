import { useLayoutEffect, useState, type RefObject } from "react";

// How far the element's top is from the top of the document, in pixels,
// whatever the scroll position: what a window virtualizer takes as its
// scrollMargin. Kept up to date as the layout changes, before the browser
// paints; 0 until the element mounts.
export function useDocumentTop(ref: RefObject<Element | null>): number {
  const [top, setTop] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => setTop(element.getBoundingClientRect().top + window.scrollY);
    update();
    // What sits above the element can change size with the page's content
    // or the window's width.
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [ref]);

  return top;
}
