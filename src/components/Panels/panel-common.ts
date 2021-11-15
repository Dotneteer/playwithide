import * as React from "react";
import { DOMAttributes } from "react";
import { CSSProperties } from "react";

/**
 * Generic panel properties
 */
export type GenericPanelProps<P = {}> = P &
  DOMAttributes<HTMLDivElement> & {
    id?: string;
    style?: CSSProperties;
    hostRef?: React.MutableRefObject<HTMLDivElement>;
    reverse?: boolean;
    onResized?: (width: number, height: number) => void;
  };
