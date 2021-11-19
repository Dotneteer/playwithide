import { useRef, useState } from "react";
import { Panel, SplitPanel, VirtualizedList } from "./Panels";
import { VirtualizedListApi } from "./Panels/VirtualizedList";

const backgrounds = ["red", "green", "blue"];

function App() {
  const [itemsCount, setItemsCount] = useState(10_000);
  const [viewport, setViewport] = useState<[number, number]>();
  const [scrollTop, setScrollTop] = useState<number>();
  const [showScrollbars, setShowScrollbars] = useState(true);

  const vlApi = useRef<VirtualizedListApi>();
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
            <button onClick={() => vlApi.current?.scrollToBottom()}>
              Bottom
            </button>
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
          </div>
          {viewport && (
            <span>
              {viewport[0]}-{viewport[1]} of {itemsCount} (top:{" "}
              {Math.floor(scrollTop ?? 0)})
            </span>
          )}
        </Panel>
      }
      panel2={
        <Panel style={{ background: "cyan" }}>
          <VirtualizedList
            focusable={true}
            itemsCount={itemsCount}
            heightMode="dynamic"
            itemHeight={30}
            showScrollbars={showScrollbars}
            wheelSpeed={0.25}
            registerApi={(api) => (vlApi.current = api)}
            renderItem={(index, style) => (
              <div
                style={{
                  ...style,
                  height: 30 + (index % 8) * 8,
                  width: "100%",
                  background: backgrounds[index % 3],
                }}
              >{`Item #${index}`}</div>
            )}
            onViewPortChanged={(s, e) => setViewport([s, e])}
            onScrolled={(t) => setScrollTop(t)}
            //obtainInitPos={() => 1234}
          />
        </Panel>
      }
      panel1MinSize={100}
      panel2MinSize="25%"
    />
  );
}

export default App;
