import * as React from "react";
import { PropsWithChildren } from "react";
import { Panel } from ".";
import { GenericPanelProps } from "./panel-common";

export type RowPanelProps = GenericPanelProps<{
  size?: number | string;
}>;

/**
 * Shortcut component to a panel that represents a row
 */
export const RowPanel: React.FC<RowPanelProps> = ({
  children,
  size,
  ...others
}: PropsWithChildren<RowPanelProps>) => {
  return <Panel forColumns={false} height={size} {...others}>{children}</Panel>;
};
