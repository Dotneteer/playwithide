// Source: https://paladini.dev/posts/how-to-make-an-extremely-reusable-tooltip-component-with-react--and-nothing-else/

import * as React from "react";
import { CSSProperties, PropsWithChildren, useState } from "react";
import "./Tooltip.scss";

export type TooltipDirection = "top" | "right" | "bottom" | "left";

export type TooltipProps = {
  content: string | JSX.Element;
  direction?: TooltipDirection;
  delay?: number;
  style?: CSSProperties;
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  direction,
  delay = 400,
  style,
  children,
}: PropsWithChildren<TooltipProps>) => {
  let timeout: NodeJS.Timeout;
  const [active, setActive] = useState(false);

  const showTip = () => {
    timeout = setTimeout(() => {
      setActive(true);
    }, delay);
  };

  const hideTip = () => {
    clearInterval(timeout);
    setActive(false);
  };

  return (
    <div
      className="Tooltip-Wrapper"
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
    >
      {children}
      {active && (
        <div className={`Tooltip-Tip ${direction || "top"}`}>{content}</div>
      )}
    </div>
  );
};
