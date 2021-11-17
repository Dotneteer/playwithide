import * as React from "react";
import { useEffect, useRef } from "react";
import { useState } from "react";
import { CSSProperties, ReactNode } from "react";
import { useResizeObserver } from "../../utils/useResizeObserver";
import { ScrollbarApi, FloatingScrollbar } from "./FloatingScrollbar";

/**
 * Properties of a scrollable panel
 */
type ScrollablePanelProps = {
  showVerticalScrollbar?: boolean;
  showHorizontalScrollbar?: boolean;
  scrollBarSize?: number;
  background?: string;
  focusable?: boolean;
  scrollItemHeight?: number;
  sizing?: (isSizing: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
} & { children?: ReactNode };

/**
 * Represents a scrollable panel with optional scrollbars
 */
export const ScrollablePanel: React.FC<ScrollablePanelProps> = ({
  children,
  showHorizontalScrollbar = true,
  showVerticalScrollbar = true,
  scrollBarSize = 16,
  background,
  focusable = true,
  scrollItemHeight = 20,
  sizing,
  onFocus,
  onBlur,
}: ScrollablePanelProps) => {
  const mounted = useRef(false);
  const verticalApi = useRef<ScrollbarApi>();
  const horizontalApi = useRef<ScrollbarApi>();

  const [pointed, setPointed] = useState(false);

  const divHost = useRef<HTMLDivElement>();
  let isSizing = false;
  let mouseLeft = false;

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    width: "100%",
    height: "100%",
    background,
    overflow: "hidden",
    outline: "none",
  };

  useEffect(() => {
    if (mounted.current) {
      updateDimensions();
    } else {
      mounted.current = true;
    }
  });

  useResizeObserver({
    element: divHost,
    callback: () => {
      updateDimensions();
    },
  });

  return (
    <div
      tabIndex={focusable ? 0 : -1}
      ref={divHost}
      style={containerStyle}
      onFocus={() => onFocus?.()}
      onBlur={() => onBlur?.()}
      onScroll={() => {
        updateDimensions();
      }}
      onMouseEnter={() => {
        setPointed(true);
        mouseLeft = false;
      }}
      onMouseLeave={() => {
        setPointed(isSizing);
        mouseLeft = true;
      }}
      onWheel={(e) => {
        divHost.current.scrollTop += e.deltaY / 4;
      }}
      onKeyDown={(e) => {
        handleScrollKeys(divHost.current, e.key, e.ctrlKey, scrollItemHeight);
      }}
    >
      {children}
      {showVerticalScrollbar && (
        <FloatingScrollbar
          direction="vertical"
          barSize={scrollBarSize}
          forceShow={pointed}
          registerApi={(api) => (verticalApi.current = api)}
          moved={(delta) => {
            if (divHost?.current) {
              divHost.current.scrollTop = delta;
            }
          }}
          sizing={(nowSizing) => {
            isSizing = nowSizing;
            sizing?.(nowSizing);
            if (!nowSizing && mouseLeft) {
              setPointed(false);
            }
          }}
        />
      )}
      {showHorizontalScrollbar && (
        <FloatingScrollbar
          direction="horizontal"
          barSize={scrollBarSize}
          forceShow={pointed}
          registerApi={(api) => (horizontalApi.current = api)}
          moved={(delta) => {
            if (divHost?.current) {
              divHost.current.scrollLeft = delta;
            }
          }}
          sizing={(nowSizing) => {
            isSizing = nowSizing;
            sizing?.(nowSizing);
            if (!nowSizing && mouseLeft) {
              setPointed(false);
            }
          }}
        />
      )}
    </div>
  );

  /**
   * Updates scrollbars according to the panel's dimension changes
   */
  function updateDimensions(): void {
    verticalApi.current?.signHostDimension({
      hostLeft: divHost.current.offsetLeft,
      hostTop: divHost.current.offsetTop,
      hostSize: divHost.current.offsetHeight,
      hostCrossSize: divHost.current.offsetWidth,
      hostScrollPos: divHost.current.scrollTop,
      hostScrollSize: divHost.current.scrollHeight,
    });
    horizontalApi.current?.signHostDimension({
      hostLeft: divHost.current.offsetLeft,
      hostTop: divHost.current.offsetTop,
      hostSize: divHost.current.offsetWidth,
      hostCrossSize: divHost.current.offsetHeight,
      hostScrollPos: divHost.current.scrollLeft,
      hostScrollSize: divHost.current.scrollWidth,
    });
  }
};

/**
 * Handles scrolling keys
 * @param element HTML element to scroll
 * @param key Key pressed
 */
export function handleScrollKeys(
  element: HTMLElement,
  key: string,
  ctrlKey: boolean,
  itemHeight = 20,
  integralHeight = false
): void {
  switch (key) {
    case "Home":
      setPos(0);
      break;
    case "ArrowDown":
      setPos(element.scrollTop + itemHeight);
      break;
    case "ArrowUp":
      setPos(element.scrollTop - itemHeight);
      break;
    case "PageDown":
      setPos(element.scrollTop + element.offsetHeight * (ctrlKey ? 5 : 1));
      break;
    case "PageUp":
      setPos(element.scrollTop - element.offsetHeight * (ctrlKey ? 5 : 1));
      break;
    case "End":
      setPos((element.scrollTop = element.scrollHeight));
      break;
  }

  function setPos(position: number): void {
    element.scrollTop = integralHeight
      ? Math.round(position / itemHeight) * itemHeight
      : position;
  }
}
