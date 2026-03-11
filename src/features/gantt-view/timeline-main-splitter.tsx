import React from "react";

type TimelineMainSplitterProps = {
  active: boolean;
  embedded?: boolean;
  ariaLabel: string;
  ariaValueMin: number;
  ariaValueMax: number;
  ariaValueNow: number;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onClick?: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export function TimelineMainSplitter(props: TimelineMainSplitterProps): React.ReactElement {
  const className = [
    "timeline-main-splitter",
    props.active ? "timeline-main-splitter-active" : "",
    props.embedded ? "timeline-main-splitter-embedded" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return React.createElement(
    "button",
    {
      type: "button",
      className,
      "aria-label": props.ariaLabel,
      role: "separator",
      "aria-orientation": "vertical",
      "aria-valuemin": props.ariaValueMin,
      "aria-valuemax": props.ariaValueMax,
      "aria-valuenow": Math.round(props.ariaValueNow),
      onPointerDown: props.onPointerDown,
      onClick: props.onClick,
      style: props.style
    },
    props.children
  );
}
