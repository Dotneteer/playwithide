import { useRef, useState } from "react";
import { Panel, SplitPanel, VirtualizedList } from "./Panels";
import { VirtualizedListApi } from "./Panels/VirtualizedList";

const backgrounds = ["red", "green", "blue"];

function App() {
  const [itemsCount, setItemsCount] = useState(1000);
  const vlApi = useRef<VirtualizedListApi>();
  return (
    <SplitPanel
      horizontal={true}
      panel1={
        <Panel
          style={{ background: "red" }}
          onClick={() => {
            vlApi.current?.scrollToItemByIndex(45);
          }}
        />
      }
      panel2={
        <Panel
          style={{ background: "lightgreen" }}
          onClick={() => setItemsCount(itemsCount + 10)}
        >
          <VirtualizedList
            itemsCount={itemsCount}
            heightMode="dynamic"
            itemHeight={30}
            showScrollbars={true}
            registerApi={(api) => (vlApi.current = api)}
            renderItem={(index, style) => (
              <div
                style={{
                  ...style,
                  height: 30 + (index % 3) * 8,
                  width: "100%",
                  background: backgrounds[index % 3],
                }}
              >{`Item #${index}`}</div>
            )}
          />
        </Panel>
      }
      panel1MinSize={100}
      panel2MinSize="25%"
    />
  );
}

export default App;
