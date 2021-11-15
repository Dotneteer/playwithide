import * as React from "react";
import { PropsWithChildren } from "react";
import { Panel } from ".";
import { GenericPanelProps } from "./panel-common";

export type ColumnPanelProps = GenericPanelProps<{
  size?: number | string;
}>;

/**
 * Shortcut component to a panel that represents a column
 */
export const ColumnPanel: React.FC<ColumnPanelProps> = ({
  children,
  size,
  ...others
}: PropsWithChildren<ColumnPanelProps>) => {
  return <Panel forColumns={true} width={size} {...others}>{children}</Panel>;
};
