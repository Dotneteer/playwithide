import * as React from "react";
import { CSSProperties, PropsWithChildren, useEffect, useRef } from "react";
import { ScrollablePanel } from ".";

const MAX_LIST_PIXELS = 10_000_000;
const CALC_BATCH_SIZE = 1000;

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
  // --- Intrinsic state
  const mounted = useRef(false);
  const heights = useRef<HeightInfo[]>([]);
  const totalHeights = useRef(0);
  const calculationQueue = useRef<number[]>([]);
  const cancelCalculation = useRef(false);

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

      // --- Sets up the initial heights
      setInitialHeights();
      processCalcQueue();
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

  console.log("Render");
  return (
    <ScrollablePanel showHorizontalScrollbar={false}>
      <div style={{ height: 10_000 }}>
        <div
          style={{
            width: 2000,
            height: 400,
            marginTop: 400,
            background: "cyan",
          }}
        >
          This is the content to scroll...
        </div>
      </div>
    </ScrollablePanel>
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
    totalHeights.current = top;
    calculationQueue.current = calcQueue;
  }

  /**
   * Processes the calculation queue
   */
  function processCalcQueue(): void {
    const queue = calculationQueue.current;
    if (queue.length === 0) {
      // --- Nothing to calculate
      return;
    }

    requestAnimationFrame(() => processBatch());

    function processBatch(): void {
      const heightInfo = heights.current;
      const start = new Date().valueOf();
      const batchItems = Math.min(queue.length, calcBatchSize);
      for (let i = 0; i < batchItems; i++) {
        if (cancelCalculation.current) {
          // --- Abort calculation when requested so
          cancelCalculation.current = false;
          return;
        }
        const itemIndex = queue.shift();
        const top = itemIndex ? heightInfo[itemIndex - 1].top : 0;
        // TODO: Carry out the real processing
        const calculatedHeight = 40;
        heightInfo[itemIndex] = {
          top: top + calculatedHeight,
          height: calculatedHeight,
          resolved: true,
        };
      }
      console.log(`Remaining items: ${queue.length}, time: ${new Date().valueOf() - start}ms`);
      if (queue.length > 0) {
        requestAnimationFrame(() => processBatch());
      }
    }
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
    return { startIndex: -1, endIndex: -1 };
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
