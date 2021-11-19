/* eslint-disable react-hooks/exhaustive-deps */
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
import { useResizeObserver } from "../../utils/useResizeObserver";
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
  getViewPort: () => Viewport;

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
   * Indicatea that scrollbars should be displayed
   */
  showScrollbars?: boolean;

  /**
   * Defers position refreshing while all items are re-measured
   */
  deferPositionRefresh?: boolean;

  /**
   * Scrolling speed when using the mouse wheel
   */
  wheelSpeed?: number;

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
  showScrollbars = false,
  deferPositionRefresh = true,
  renderItem,
  registerApi,
  obtainInitPos,
  scrolled,
  onFocus,
  onBlur,
  handleKeys,
}: PropsWithChildren<VirtualizedListProps>) => {
  // --- Explicit state
  const [totalHeight, setTotalHeight] = useState(0);
  const [requestedPos, setRequestedPos] = useState(-1);
  const [elementsToSize, setElementsToSize] =
    useState<Map<number, JSX.Element>>();
  const [visibleElements, setVisibleElements] = useState<VisibleItem[]>();

  // --- Intrinsic state
  const mounted = useRef(false);
  const heights = useRef<HeightInfo[]>([]);
  const calculationQueue = useRef<number[]>([]);
  const cancelCalculation = useRef(false);
  const scrollPosition = useRef(0);
  const lastViewport = useRef<Viewport>({
    startIndex: -1,
    endIndex: -1,
  });
  const measuring = useRef(false);

  // --- Component host element
  const componentHost = useRef<HTMLDivElement>();
  const verticalApi = useRef<ScrollbarApi>();
  const horizontalApi = useRef<ScrollbarApi>();
  const sizerHost = useRef<HTMLDivElement>();
  const firstElementIndex = useRef(-1);

  // --- Mount and unmount the component
  useEffect(() => {
    if (!mounted.current) {
      // --- Mount the component
      mounted.current = true;
      cancelCalculation.current = false;

      // --- Register the API with the host component
      registerApi?.({
        forceRefresh: (position?: number) => forceRefresh(position),
        scrollToItemByIndex: (index) => scrollToItemByIndex(index),
        scrollToTop: () => scrollToTop(),
        scrollToBottom: () => scrollToBottom(),
        getViewPort: () => getViewPort(),
        ensureVisible: (index: number) => ensureVisible(index),
        focus: () => () => focus(),
      });
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
    measuring.current = heightMode === "dynamic";
    requestAnimationFrame(() => {
      // --- Process the first batch of elements to measure their size
      processHeightMeasureBatch();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsCount]);

  // --- Whenever elements are rendered for measure, process them
  useLayoutEffect(() => {
    applyMeasuredItemDimensions();

    // --- Is there a next batch?
    if (calculationQueue.current.length === 0) {
      // --- No more elements to measure
      setElementsToSize(undefined);
      measuring.current = false;
    } else {
      // --- Process the nex batch of elements
      processHeightMeasureBatch();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementsToSize]);

  useResizeObserver({
    element: componentHost,
    callback: () => {
      // --- Update the scollbar dimensions
      updateScrollbarDimensions();
      updateRequestedPosition();
      renderVisibleElements();
    },
  });

  // --- Update scrollbar dimensions and position
  useLayoutEffect(() => {
    updateScrollbarDimensions();
    updateRequestedPosition();

    // --- Now, render the elements visible in the viewport
    renderVisibleElements();
  });

  useLayoutEffect(() => {
    renderVisibleElements();
  }, [visibleElements]);

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
          //outline: "",
        }}
        onScroll={(e) => {
          // TODO
        }}
        onWheel={(e) =>
          setRequestedPos(
            Math.max(0, scrollPosition.current + (e.deltaY/20) * itemHeight)
          )
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
          onMouseEnter={() => displayScrollbars(true)}
          onMouseLeave={() => displayScrollbars(false)}
        >
          {visibleElements &&
            visibleElements.map((ve) => (
              <React.Fragment key={ve.index}>{ve.item}</React.Fragment>
            ))}
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
        </div>
      </div>
      <FloatingScrollbar
        direction="vertical"
        barSize={16}
        registerApi={(api) => (verticalApi.current = api)}
        moved={(delta) => setRequestedPos(delta)}
        forceShow={showScrollbars}
        sizing={(nowSizing) => {
          // TODO
        }}
      />
      <FloatingScrollbar
        direction="horizontal"
        barSize={10}
        registerApi={(api) => (horizontalApi.current = api)}
        moved={(delta) => setRequestedPos(delta)}
        forceShow={showScrollbars}
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
      var item = renderItem(itemIndex, explicitItemType);
      newElementsToSize.set(itemIndex, item);
    }
    firstElementIndex.current = firstIndex;
    setElementsToSize(newElementsToSize);
  }

  /**
   * Processes the dimensions of the measured items
   */
  function applyMeasuredItemDimensions(): void {
    if (elementsToSize && elementsToSize.size > 0) {
      // --- Iterate through the sizes of elements and store them
      const heightInfo = heights.current;
      let lastHeightInfo: HeightInfo | null = null;
      let lastIndex = sizerHost.current.childNodes.length;
      const firstIndex = firstElementIndex.current;
      let top = firstIndex
        ? heightInfo[firstIndex - 1].top + heightInfo[firstIndex - 1].height
        : 0;
      for (let i = 0; i < lastIndex; i++) {
        // --- Get the next element
        const element = sizerHost.current.childNodes[i] as HTMLDivElement;
        const itemIndex = i + firstElementIndex.current;
        const measuredHeight = element.offsetHeight;

        // --- Read the element size and calculate position
        lastHeightInfo = heightInfo[itemIndex] = {
          top: top,
          height: measuredHeight,
          resolved: true,
        };
        top += measuredHeight;
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

        // --- Set the new height
        setTotalHeight(nextTop);
      }
    }
  }

  /**
   * Let the scrollbars know the new host component dimensions
   */
  function updateScrollbarDimensions(): void {
    if (deferPositionRefresh && measuring.current) {
      return;
    }

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

  /**
   * Update the scrollbar's position to the requested one
   */
  function updateRequestedPosition(): void {
    if (requestedPos >= 0 && (!deferPositionRefresh || !measuring.current)) {
      componentHost.current.scrollTop = requestedPos;
      scrollPosition.current = componentHost.current.scrollTop;
      scrolled?.(scrollPosition.current);
      setRequestedPos(-1);
    }
  }

  /**
   * Display the visible elements
   * @returns
   */
  function renderVisibleElements(force = false): void {
    if (deferPositionRefresh && measuring.current) {
      return;
    }

    const view = getViewPort();
    if (view.startIndex < 0 || view.endIndex < 0) {
      // --- The viewport is empty
      return;
    }

    // --- We have to avoid continuous React updates, so we
    // --- carry out rendering only if forced, or the viewport
    // --- changes
    if (
      !force &&
      lastViewport.current.startIndex === view.startIndex &&
      lastViewport.current.endIndex === view.endIndex
    ) {
      // --- The viewport has not changed
      return;
    }
    lastViewport.current = view;

    // --- Render the elements in the viewport
    const visible: VisibleItem[] = [];
    for (let i = view.startIndex; i <= view.endIndex; i++) {
      visible.push({
        index: i,
        item: renderItem(i, {
          ...explicitItemType,
          top: heights.current[i].top,
        }),
      });
    }
    setVisibleElements(visible);
  }

  /**
   * Displays or hides the scrollbars
   * @param show Indicates if scrollbars should be displayed
   */
  function displayScrollbars(show: boolean): void {
    verticalApi.current?.display(show);
    horizontalApi.current?.display(show);
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
  function scrollToItemByIndex(index: number): void {
    const heightItem = heights.current[index];
    if (heightItem) {
      setRequestedPos(heightItem.top);
    }
  }

  /**
   * Scrolls to the top
   */
  function scrollToTop(): void {
    setRequestedPos(0);
  }

  /**
   * Scrolls to the bottom
   */
  function scrollToBottom(): void {
    setRequestedPos(MAX_LIST_PIXELS);
  }

  /**
   * Retrieves the current viewport of the virtual list
   */
  function getViewPort(): Viewport {
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
   * entirelly in the current viewport
   */
  function ensureVisible(index: number): void {
    // TODO: Implement this
  }

  /**
   * Ensures that the virtualized list gets the focus
   */
  function focus(): void {
    requestAnimationFrame(() => componentHost.current?.focus());
  }
};

// ----------------------------------------------------------------------------
// Helper types and values

/**
 * Height information of a particular list item
 */
type HeightInfo = {
  top: number;
  height: number;
  resolved: boolean;
};

/**
 * Information about a visible item
 */
type VisibleItem = {
  index: number;
  item: JSX.Element;
};

/**
 * Viewport information
 */
type Viewport = { startIndex: number; endIndex: number };

/**
 * Each virtual item has this type for measuring and displaying the item
 */
const explicitItemType: CSSProperties = {
  position: "absolute",
  top: 0,
  overflowX: "hidden",
  whiteSpace: "nowrap",
};
