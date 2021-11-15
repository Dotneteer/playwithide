import * as React from "react";
import { PropsWithChildren } from "react";
import { useResizeObserver } from "../../utils/useResizeObserver";
import { GenericPanelProps } from "./panel-common";

export type PanelProps = GenericPanelProps<{
  width?: number | string;
  height?: number | string;
  forColumns?: boolean;
}>;

/**
 * Panel component, which fills its parent's entire client area, unless
 * dimensions are not specified
 */
export const Panel: React.FC<PanelProps> = ({
  children,
  style,
  hostRef,
  width,
  height,
  forColumns,
  reverse,
  onResized,
  ...others
}: PropsWithChildren<PanelProps>) => {
  const adjustable = width !== undefined || height !== undefined ? 0 : 1;
  const flexDirection = forColumns
    ? reverse
      ? "row-reverse"
      : "row"
    : reverse
    ? "column-reverse"
    : "column";

  useResizeObserver({
    element: hostRef,
    callback: () => {
      onResized?.(
        hostRef?.current?.offsetWidth ?? -1,
        hostRef?.current?.offsetHeight ?? -1
      );
    },
  });

  return (
    <div
      ref={hostRef}
      style={{
        width: width ?? "100%",
        height: height ?? "100%",
        display: "flex",
        flexDirection,
        flexShrink: adjustable,
        flexGrow: adjustable,
        overflow: "hidden",
        ...style,
      }}
      {...others}
    >
      {children}
    </div>
  );
};
