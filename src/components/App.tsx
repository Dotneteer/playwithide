import { Panel, SplitPanel } from "./Panels";
import ScrollablePanel from "./Panels/ScrollablePanel";

function App() {
  return (
    <SplitPanel
      horizontal={true}
      panel1={<Panel style={{ background: "red" }} />}
      panel1MinSize={100}
      panel2={
        <Panel style={{ background: "green" }}>
          <ScrollablePanel>
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
        </Panel>
      }
      panel2MinSize="25%"
    />
  );
}

export default App;
