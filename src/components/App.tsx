import { useRef, useState } from "react";
import { Panel, SplitPanel, VirtualizedList } from "./Panels";
import { VirtualizedListApi } from "./VirtualizedList/VirtualizedList";
import { Tooltip } from "./Tooltip/Tooltip";

const backgrounds = ["red", "green", "blue"];

function App() {
  const [itemsCount, setItemsCount] = useState(1_000);
  const [viewport, setViewport] = useState<[number, number]>();
  const [scrollTop, setScrollTop] = useState<number>();
  const [showScrollbars, setShowScrollbars] = useState(true);
  const [measureIndex, setMeasureIndex] = useState(-1);

  const vlApi = useRef<VirtualizedListApi>();

  // --- Fix size scenario
  return (
    <SplitPanel
      horizontal={true}
      panel1={
        <Panel
          style={{
            background: "lightgreen",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div>
            <button onClick={() => vlApi.current?.scrollToTop()}>Top</button>
            <Tooltip content="Hello!">
              <button onClick={() => vlApi.current?.scrollToBottom()}>
                Bottom
              </button>
            </Tooltip>
            <button onClick={() => vlApi.current?.scrollToItemByIndex(42)}>
              To #42
            </button>
            <button onClick={() => setItemsCount(itemsCount + 10)}>
              +10 new items
            </button>
            <button onClick={() => setShowScrollbars(!showScrollbars)}>
              Toggle floating scrollbar
            </button>
            <button onClick={() => vlApi.current?.ensureVisible(100, "top")}>
              #100 (top)
            </button>
            <button onClick={() => vlApi.current?.ensureVisible(200, "bottom")}>
              #200 (bottom)
            </button>
            <button onClick={() => vlApi.current?.ensureVisible(300, "center")}>
              #300 (center)
            </button>
            <button
              onClick={() => {
                const newIndex = measureIndex < 0 ? 0 : measureIndex + 10;
                setMeasureIndex(newIndex);
                vlApi.current?.remeasure(newIndex, newIndex + 10);
              }}
            >
              Re-measure +10
            </button>
            <button onClick={() => vlApi.current?.forceRefresh()}>
              Force refresh
            </button>
          </div>
          {viewport && (
            <span>
              {viewport[0]}-{viewport[1]} of {itemsCount} (top:{" "}
              {Math.floor(scrollTop ?? 0)})
            </span>
          )}
        </Panel>
      }
      // ======================================================================
      // #1: Fix size scenario
      // ======================================================================
      // panel2={
      //   <Panel style={{ background: "cyan" }}>
      //     <VirtualizedList
      //       focusable={true}
      //       itemsCount={itemsCount}
      //       heightMode="fix"
      //       itemHeight={30}
      //       showScrollbars={showScrollbars}
      //       horizontalRemeasure={true}
      //       registerApi={(api) => (vlApi.current = api)}
      //       renderItem={(index, style) => (
      //         <div
      //           style={{
      //             ...style,
      //             height:
      //               measureIndex >= 0 && index < measureIndex + 10 ? 100 : 30,
      //             width: "100%",
      //             whiteSpace: "nowrap",
      //             background:
      //               measureIndex >= 0 && index < measureIndex + 10
      //                 ? index % 2
      //                   ? "cyan"
      //                   : "orangered"
      //                 : backgrounds[index % 3],
      //           }}
      //         >
      //           {`Item #${index}`}
      //         </div>
      //       )}
      //       onViewPortChanged={(s, e) => setViewport([s, e])}
      //       onScrolled={(t) => setScrollTop(t)}
      //     />
      //   </Panel>
      // }

      // ======================================================================
      // #2: Variable size scenario
      // ======================================================================
      // panel2={
      //   <Panel style={{ background: "cyan" }}>
      //     <VirtualizedList
      //       focusable={true}
      //       itemsCount={itemsCount}
      //       heightMode="variable"
      //       itemHeight={30}
      //       reposition = {false}
      //       showScrollbars={showScrollbars}
      //       registerApi={(api) => (vlApi.current = api)}
      //       renderItem={(index, style) => (
      //         <div
      //           style={{
      //             ...style,
      //             height:
      //               measureIndex >= 0 && index < measureIndex + 10
      //                 ? 100
      //                 : 30 + (index % 8) * 8,
      //             width: "100%",
      //             whiteSpace: "nowrap",
      //             background:
      //               measureIndex >= 0 && index < measureIndex + 10
      //                 ? index % 2
      //                   ? "cyan"
      //                   : "orangered"
      //                 : backgrounds[index % 3], 
      //           }}
      //         >
      //           {`Item #${index}`}
      //         </div>
      //       )}
      //       onViewPortChanged={(s, e) => setViewport([s, e])}
      //       onScrolled={(t) => setScrollTop(t)}
      //     />
      //   </Panel>
      // }

      // ======================================================================
      // #3: Variable size scenario with horizontal rem-measuring
      // ======================================================================
      // panel2={
      //   <Panel style={{ background: "cyan" }}>
      //     <VirtualizedList
      //       focusable={true}
      //       itemsCount={itemsCount}
      //       heightMode="variable"
      //       itemHeight={30}
      //       showScrollbars={showScrollbars}
      //       horizontalRemeasure={true}
      //       reposition={false}
      //       registerApi={(api) => (vlApi.current = api)}
      //       renderItem={(index, style) => (
      //         <div
      //           style={{
      //             ...style,
      //             height:
      //               measureIndex >= 0 && index < measureIndex + 10
      //                 ? 100
      //                 : "auto", // 30 + (index % 8) * 8,
      //             width: "100%",
      //             background:
      //               measureIndex >= 0 && index < measureIndex + 10
      //                 ? index % 2
      //                   ? "cyan"
      //                   : "orangered"
      //                 : backgrounds[index % 3],
      //           }}
      //         >
      //           {`Long, long, long, long, long, long, long, long, long, long, long, long, long, Item #${index}`}
      //         </div>
      //       )}
      //       onViewPortChanged={(s, e) => setViewport([s, e])}
      //       onScrolled={(t) => setScrollTop(t)}
      //     />
      //   </Panel>
      // }

      // ======================================================================
      // #4: First item size scenario
      // ======================================================================
      panel2={
        <Panel style={{ background: "cyan" }}>
          <VirtualizedList
            focusable={true}
            itemsCount={itemsCount}
            heightMode="first"
            showScrollbars={showScrollbars}
            reposition={true}
            registerApi={(api) => (vlApi.current = api)}
            renderItem={(index, style) => (
              <div
                style={{
                  ...style,
                  height:
                    measureIndex >= 0 && index < measureIndex + 10 ? 100 : 40,
                  width: "100%",
                  background:
                    measureIndex >= 0 && index < measureIndex + 10
                      ? index % 2
                        ? "cyan"
                        : "orangered"
                      : backgrounds[index % 3],
                  overflowY: "hidden",
                }}
              >
                {`Long, long, long, long, long, long, long, long, long, long, long, long, long, Item #${index}`}
              </div>
            )}
            onViewPortChanged={(s, e) => setViewport([s, e])}
            onScrolled={(t) => setScrollTop(t)}
          />
        </Panel>
      }
      panel1MinSize={100}
      panel2MinSize="25%"
    />
  );
}

export default App;
