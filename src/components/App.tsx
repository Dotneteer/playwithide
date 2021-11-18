import { useState } from "react";
import { Panel, SplitPanel, VirtualizedList } from "./Panels";

function App() {
  const [itemsCount, setItemsCount] = useState(1000);
  return (
    <SplitPanel
      horizontal={true}
      panel1={<Panel style={{ background: "red" }} />}
      panel2={
        <Panel
          style={{ background: "green" }}
          onClick={() => setItemsCount(itemsCount + 1)}
        >
          <VirtualizedList
            itemsCount={itemsCount}
            heightMode="dynamic"
            renderItem={(index, style) => <div style={{ ...style, height: 32 }}>{`Item #${index}`}</div>}
          />
        </Panel>
      }
      panel1MinSize={100}
      panel2MinSize="25%"
    />
  );
}

export default App;
