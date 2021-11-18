import * as React from "react";
import {
  CSSProperties,
  PropsWithChildren,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FloatingScrollbar } from ".";
import { ScrollbarApi } from "./FloatingScrollbar";

const MAX_LIST_PIXELS = 10_000_000;
const CALC_BATCH_SIZE = 200;

/**
 * The function that renders a virtual list item
 */
export type ItemRenderer = (index: number, style: CSSProperties) => JSX.Element;

/**
 * Represents the API the hosts of a virtual list can invoke
 */
export type VirtualizedListApi = {
  /**
   * Forces refreshing the list
   */
  forceRefresh: (position?: number) => void;

  /**
   * Scrolls to the item with the specified index
   */
  scrollToItemByIndex: (index: number, withRefresh?: boolean) => void;

  /**
   * Scrolls to the top
   */
  scrollToTop: (withRefresh?: boolean) => void;

  /**
   * Scrolls to the bottom
   */
  scrollToBottom: (withRefresh?: boolean) => void;

  /**
   * Retrieves the current viewport of the virtual list
   */
  getViewPort: () => { startIndex: number; endIndex: number };

  /**
   * Ensures that the item with the specified index gets visible
   * in the current viewport
   */
  ensureVisible: (index: number) => void;

  /**
   * Ensures that the virtualized list gets the focus
   */
  focus: () => void;
};

/**
 * The item height mode of the virtualized list
 */
export type ItemHeightMode = "fixed" | "dynamic";

/**
 * The properties of the virtualized list
 */
export type VirtualizedListProps = {
  /**
   * The number of items in the list
   */
  itemsCount: number;

  /**
   * Item height mode
   */
  heightMode?: ItemHeightMode;

  /**
   * Item heights (used only in "fixed" mode)
   */
  itemHeight?: number;

  /**
   * Is the virtualized list focusable?
   */
  focusable?: boolean;

  /**
   * Extra style information to tadd to the list
   */
  style?: CSSProperties;

  /**
   * The number of calculation queue items processed within
   * an animation frame
   */
  calcBatchSize?: number;

  /**
   * The function that renders a particular item
   */
  renderItem: ItemRenderer;

  /**
   * Function to register the API of the virtualized list
   */
  registerApi?: (api: VirtualizedListApi) => void;

  /**
   * Function to defin the initial scroll position
   */
  obtainInitPos?: () => number | null;

  /**
   * Function called when the list's scroll position has been changed
   */
  scrolled?: (topPos: number) => void;

  /**
   * Function called when the list receives the focus
   */
  onFocus?: () => void;

  /**
   * Function called when the list losts the focus
   */
  onBlur?: () => void;

  /**
   * The host can take control of handling the keys
   */
  handleKeys?: (e: React.KeyboardEvent) => void;
};

/**
 * Implements a vertically scrollable virtualized list
 */
export const VirtualizedList: React.FC<VirtualizedListProps> = ({
  itemsCount,
  heightMode,
  itemHeight = 20,
  focusable,
  style,
  calcBatchSize = CALC_BATCH_SIZE,
  renderItem,
  registerApi,
  obtainInitPos,
  scrolled,
  onFocus,
  onBlur,
  handleKeys,
}: PropsWithChildren<VirtualizedListProps>) => {
  // --- Explicit state
  const [pointed, setPointed] = useState(false);
  const [totalHeight, setTotalHeight] = useState(0);
  const [requestedPos, setRequestedPos] = useState(-1);
  const [elementsToSize, setElementsToSize] =
    useState<Map<number, JSX.Element>>();

  // --- Intrinsic state
  const mounted = useRef(false);
  const heights = useRef<HeightInfo[]>([]);
  const calculationQueue = useRef<number[]>([]);
  const cancelCalculation = useRef(false);
  const scrollPosition = useRef(0);

  // --- Component host element
  const componentHost = useRef<HTMLDivElement>();
  const verticalApi = useRef<ScrollbarApi>();
  const horizontalApi = useRef<ScrollbarApi>();
  const sizerHost = useRef<HTMLDivElement>();
  const firstElementIndex = useRef(-1);

  useEffect(() => {
    if (!mounted.current) {
      // --- Mount the component
      mounted.current = true;
      cancelCalculation.current = false;

      // --- Register the API with the host component
      registerApi?.({
        forceRefresh: (position?: number) => forceRefresh(position),
        scrollToItemByIndex: (index, withRefresh) =>
          scrollToItemByIndex(index, withRefresh),
        scrollToTop: (withRefresh) => scrollToTop(withRefresh),
        scrollToBottom: (withRefresh) => scrollToBottom(withRefresh),
        getViewPort: () => getViewPort(),
        ensureVisible: (index: number) => ensureVisible(index),
        focus: () => () => focus(),
      });
    } else {
      // --- Other updates
    }

    return () => {
      // --- Cancel any item length calculation in progress
      cancelCalculation.current = true;

      // --- Unmount completed
      mounted.current = false;
    };
  });

  // --- Whenever the number of items changes, initialize item heights
  useLayoutEffect(() => {
    // --- Sets up the initial heights
    setInitialHeights();
    requestAnimationFrame(() => {
      // --- Process the first batch of elements to measure their size
      processHeightMeasureBatch();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsCount]);

  // --- Whenever elements are sized, process them
  useLayoutEffect(() => {
    if (elementsToSize && elementsToSize.size > 0) {
      // --- Iterate through the sizes of elements and store them
      const heightInfo = heights.current;
      let lastHeightInfo: HeightInfo | null = null;
      let lastIndex = sizerHost.current.childNodes.length;
      for (let i = 0; i < lastIndex; i++) {
        // --- Get the next element
        const element = sizerHost.current.childNodes[i] as HTMLDivElement;
        const itemIndex = i + firstElementIndex.current;
        const top = itemIndex ? heightInfo[itemIndex - 1].top : 0;

        // --- Read the element size and calculate position
        const measuredHeight = element.offsetHeight;
        lastHeightInfo = heightInfo[itemIndex] = {
          top: top + measuredHeight,
          height: measuredHeight,
          resolved: true,
        };
      }

      // --- Now, shift the remaining items
      if (lastHeightInfo) {
        let nextTop = lastHeightInfo.top + lastHeightInfo.height;
        for (
          let i = lastIndex + firstElementIndex.current;
          i < heightInfo.length;
          i++
        ) {
          heightInfo[i].top = nextTop;
          nextTop += heightInfo[i].height;
        }
      }
      console.log(heights.current)
    }

    // --- Is there a next batch?
    if (calculationQueue.current.length === 0) {
      // --- Nothing to calculate
      setElementsToSize(undefined);
    } else {
      // --- Process the nex batch of elements
      processHeightMeasureBatch();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementsToSize]);

  // --- Update scrollbar dimensions and position
  useLayoutEffect(() => {
    // --- Update the scollbar dimensions
    updateScrollbarDimensions();
    updateRequestedPosition();

    // --- Now, render the elements visible in the viewport
    renderVisibleElements();
  });

  return (
    <>
      <div
        tabIndex={focusable ? 0 : -1}
        ref={componentHost}
        style={{
          ...style,
          overflow: "hidden",
          position: "relative",
          height: "100%",
          outline: "none",
        }}
        onScroll={(e) => {
          // TODO
        }}
        onWheel={
          (e) => {}
          // TODO
        }
        onKeyDown={(e) => {}}
        onFocus={() => focus?.()}
        onBlur={() => {}}
      >
        <div
          className="inner"
          style={{
            height: `${totalHeight}px`,
          }}
          onMouseEnter={() => setPointed(true)}
          onMouseLeave={() => setPointed(false)}
        >
          <div
            ref={sizerHost}
            style={{
              display: "block",
              position: "absolute",
              top: MAX_LIST_PIXELS,
            }}
          >
            {elementsToSize &&
              Array.from(elementsToSize.entries()).map((item) => (
                <React.Fragment key={item[0]}>{item[1]}</React.Fragment>
              ))}
          </div>
          This is scrollable
        </div>
      </div>
      <FloatingScrollbar
        direction="vertical"
        barSize={16}
        forceShow={pointed}
        registerApi={(api) => (verticalApi.current = api)}
        moved={(delta) => {
          setRequestedPos(delta);
        }}
        sizing={(nowSizing) => {
          // TODO
        }}
      />
      <FloatingScrollbar
        direction="horizontal"
        barSize={10}
        forceShow={pointed}
        registerApi={(api) => (horizontalApi.current = api)}
        moved={(delta) => {
          setRequestedPos(delta);
        }}
        sizing={(nowSizing) => {
          // TODO
        }}
      />
    </>
  );

  // --------------------------------------------------------------------------
  // Helper functions

  /**
   * Sets the initial heights of items after mounting the component
   */
  function setInitialHeights(): void {
    const initial: HeightInfo[] = [];
    initial.length = itemsCount;
    const calcQueue: number[] = [];
    calcQueue.length = heightMode === "dynamic" ? itemsCount : 0;
    let top = 0;
    for (let i = 0; i < itemsCount; i++) {
      initial[i] = {
        top,
        height: itemHeight,
        resolved: heightMode === "fixed",
      };
      top += itemHeight;
      if (heightMode === "dynamic") {
        calcQueue[i] = i;
      }
      if (top > MAX_LIST_PIXELS) {
        throw new Error(
          `The total height of the virtualized list cannot be greater than ${MAX_LIST_PIXELS}. ` +
            `Now, the list has ${itemsCount} items and item #${i} violates the maximum total height.`
        );
      }
    }
    heights.current = initial;
    setTotalHeight(top);
    calculationQueue.current = calcQueue;
  }

  /**
   * Processes the calculation queue
   */
  function processHeightMeasureBatch(): void {
    const queue = calculationQueue.current;
    if (queue.length === 0) {
      // --- Nothing to calculate
      return;
    }
    const heightInfo = heights.current;
    const batchItems = Math.min(queue.length, calcBatchSize);

    const newElementsToSize = new Map<number, JSX.Element>();
    let firstIndex = -1;
    for (let i = 0; i < batchItems; i++) {
      if (cancelCalculation.current) {
        // --- Abort calculation when requested so
        cancelCalculation.current = false;
        return;
      }
      const itemIndex = queue.shift();
      if (firstIndex < 0) {
        firstIndex = itemIndex;
      }
      var item = renderItem(itemIndex, {
        position: "absolute",
        top: 0,
        overflowX: "hidden",
        whiteSpace: "nowrap",
      });
      newElementsToSize.set(itemIndex, item);
      const top = itemIndex ? heightInfo[itemIndex - 1].top : 0;
      // TODO: Carry out the real processing
      const calculatedHeight = 40;
      heightInfo[itemIndex] = {
        top: top + calculatedHeight,
        height: calculatedHeight,
        resolved: true,
      };
    }
    firstElementIndex.current = firstIndex;
    setElementsToSize(newElementsToSize);
  }

  /**
   * Let the scrollbars know the new host component dimensions
   */
  function updateScrollbarDimensions(): void {
    const host = componentHost.current;
    verticalApi.current?.signHostDimension({
      hostLeft: host.offsetLeft,
      hostTop: host.offsetTop,
      hostSize: host.offsetHeight,
      hostCrossSize: host.offsetWidth,
      hostScrollPos: host.scrollTop,
      hostScrollSize: host.scrollHeight,
    });
    horizontalApi.current?.signHostDimension({
      hostLeft: host.offsetLeft,
      hostTop: host.offsetTop,
      hostSize: host.offsetWidth,
      hostCrossSize: host.offsetHeight,
      hostScrollPos: host.scrollLeft,
      hostScrollSize: host.scrollWidth,
    });
  }

  function updateRequestedPosition(): void {
    if (requestedPos >= 0) {
      componentHost.current.scrollTop = requestedPos;
      scrollPosition.current = componentHost.current.scrollTop;
      scrolled?.(scrollPosition.current);
      setRequestedPos(-1);
    }
  }

  function renderVisibleElements(): void {
    console.log(getViewPort());
  }

  // --------------------------------------------------------------------------
  // Virtualized list API to be called by host components

  /**
   * Forces refreshing the list
   */
  function forceRefresh(position?: number): void {
    // TODO: Implement this
  }

  /**
   * Scrolls to the item with the specified index
   */
  function scrollToItemByIndex(index: number, withRefresh?: boolean): void {
    // TODO: Implement this
  }

  /**
   * Scrolls to the top
   */
  function scrollToTop(withRefresh?: boolean): void {
    // TODO: Implement this
  }

  /**
   * Scrolls to the bottom
   */
  function scrollToBottom(withRefresh?: boolean): void {
    // TODO: Implement this
  }

  /**
   * Retrieves the current viewport of the virtual list
   */
  function getViewPort(): { startIndex: number; endIndex: number } {
    if (!heights.current || !componentHost.current) {
      return { startIndex: -1, endIndex: -1 };
    }
    var scrollTop = componentHost.current.scrollTop;
    var height = componentHost.current.offsetHeight;
    const startIndex = binarySearch(heights.current, scrollTop);
    const endIndex = binarySearch(heights.current, scrollTop + height);
    const result = { startIndex, endIndex };
    return result;

    function binarySearch(items: HeightInfo[], value: number): number {
      var startIndex = 0,
        stopIndex = items.length - 1,
        middle = Math.floor((stopIndex + startIndex) / 2);

      while (
        (value < items[middle].top ||
          value >= items[middle].top + items[middle].height) &&
        startIndex < stopIndex
      ) {
        // --- Adjust search area
        if (value < items[middle].top) {
          stopIndex = middle - 1;
        } else if (value > items[middle].top) {
          startIndex = middle + 1;
        }

        // --- Recalculate middle
        middle = Math.max(0, Math.floor((stopIndex + startIndex) / 2));
      }

      // --- Done
      return middle;
    }
  }

  /**
   * Ensures that the item with the specified index gets visible
   * in the current viewport
   */
  function ensureVisible(index: number): void {
    // TODO: Implement this
  }

  /**
   * Ensures that the virtualized list gets the focus
   */
  function focus(): void {
    // TODO: Implement this
  }
};

// ----------------------------------------------------------------------------
// Helper types

/**
 * Height information of a particular list item
 */
type HeightInfo = {
  top: number;
  height: number;
  resolved: boolean;
};
