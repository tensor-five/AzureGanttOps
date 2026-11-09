import React from "react";

import type { DetailsFieldCatalog, DetailsFieldDescriptor } from "./details-panel-field-catalog.js";

export type DetailsPanelFieldConfigMenuProps = {
  catalog: DetailsFieldCatalog;
  shownIds: string[];
  onChangeShownIds: (nextIds: string[]) => void;
  onReset: () => void;
};

export function DetailsPanelFieldConfigMenu(props: DetailsPanelFieldConfigMenuProps): React.ReactElement {
  const [search, setSearch] = React.useState("");
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);
  const itemRefs = React.useRef(new Map<string, HTMLLIElement>());
  const pendingFocusIdRef = React.useRef<string | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const constrainHeight = () => {
      dialog.style.maxHeight = `${resolveDialogMaxHeightPx(dialog)}px`;
    };
    constrainHeight();
    dialog.focus({ preventScroll: true });
    window.addEventListener("resize", constrainHeight);
    window.addEventListener("scroll", constrainHeight, true);
    return () => {
      window.removeEventListener("resize", constrainHeight);
      window.removeEventListener("scroll", constrainHeight, true);
    };
  }, []);

  React.useEffect(() => {
    const focusId = pendingFocusIdRef.current;
    if (focusId) {
      pendingFocusIdRef.current = null;
      itemRefs.current.get(focusId)?.focus();
    }
  });

  const moveItem = (from: number, to: number, focusAfterMove = false) => {
    if (from === to || to < 0 || to >= props.shownIds.length) {
      return;
    }
    const next = [...props.shownIds];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    if (focusAfterMove) {
      pendingFocusIdRef.current = moved;
    }
    props.onChangeShownIds(next);
  };

  const normalizedSearch = search.trim().toLowerCase();
  const available = props.catalog.fields
    .filter((field) => !props.shownIds.includes(field.id))
    .sort((left, right) => left.name.localeCompare(right.name))
    .filter(
      (field) =>
        normalizedSearch.length === 0 ||
        field.name.toLowerCase().includes(normalizedSearch) ||
        field.subtitle.toLowerCase().includes(normalizedSearch)
    );

  const finishDrag = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return React.createElement(
    "div",
    { className: "timeline-details-config-menu", role: "dialog", "aria-label": "Details fields", ref: dialogRef, tabIndex: -1 },
    React.createElement(
      "div",
      { className: "timeline-details-config-head" },
      React.createElement("h4", { className: "timeline-details-config-title" }, "Details fields"),
      React.createElement(
        "button",
        { type: "button", className: "timeline-details-config-reset", onClick: props.onReset },
        "Reset to default"
      )
    ),
    React.createElement(
      "p",
      { className: "timeline-details-config-section-title" },
      React.createElement("span", null, "Shown"),
      React.createElement("span", null, String(props.shownIds.length))
    ),
    React.createElement(
      "ul",
      { className: "timeline-details-config-list", "aria-label": "Shown fields" },
      ...props.shownIds.map((fieldId, index) => {
        const field = props.catalog.byId.get(fieldId) ?? null;
        const name = field?.name ?? fieldId;
        const className = [
          "timeline-details-config-item",
          field ? "" : "timeline-details-config-item-unavailable",
          dragIndex === index ? "timeline-details-config-item-dragging" : "",
          dropIndex === index && dragIndex !== null && dragIndex !== index ? "timeline-details-config-item-drop-before" : ""
        ]
          .filter(Boolean)
          .join(" ");
        return React.createElement(
          "li",
          {
            key: fieldId,
            ref: (element: HTMLLIElement | null) => {
              if (element) {
                itemRefs.current.set(fieldId, element);
              } else {
                itemRefs.current.delete(fieldId);
              }
            },
            className,
            draggable: true,
            tabIndex: 0,
            "aria-label": `${name}, position ${index + 1} of ${props.shownIds.length}`,
            onKeyDown: (event: React.KeyboardEvent<HTMLLIElement>) => {
              if (!event.altKey || event.target !== event.currentTarget) {
                return;
              }
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                moveItem(index, event.key === "ArrowUp" ? index - 1 : index + 1, true);
              }
            },
            onDragStart: (event: React.DragEvent<HTMLLIElement>) => {
              setDragIndex(index);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", fieldId);
            },
            onDragOver: (event: React.DragEvent<HTMLLIElement>) => {
              if (dragIndex === null) {
                return;
              }
              event.preventDefault();
              if (dropIndex !== index) {
                setDropIndex(index);
              }
            },
            onDrop: (event: React.DragEvent<HTMLLIElement>) => {
              if (dragIndex === null) {
                return;
              }
              event.preventDefault();
              const target = dragIndex < index ? index - 1 : index;
              moveItem(dragIndex, target);
              finishDrag();
            },
            onDragEnd: finishDrag
          },
          gripIcon(),
          React.createElement(
            "span",
            { className: "timeline-details-config-meta" },
            React.createElement("strong", null, name),
            React.createElement("span", null, field?.subtitle ?? fieldId)
          ),
          React.createElement("span", { className: "timeline-details-config-badges" }, ...renderBadges(field)),
          React.createElement(
            "span",
            { className: "timeline-details-config-actions" },
            iconButton(`Move ${name} up`, "↑", index === 0, () => moveItem(index, index - 1)),
            iconButton(`Move ${name} down`, "↓", index === props.shownIds.length - 1, () => moveItem(index, index + 1)),
            iconButton(`Remove ${name}`, "×", false, () => {
              const neighbor = props.shownIds[index + 1] ?? props.shownIds[index - 1] ?? null;
              pendingFocusIdRef.current = neighbor;
              props.onChangeShownIds(props.shownIds.filter((entry) => entry !== fieldId));
            })
          )
        );
      })
    ),
    React.createElement(
      "p",
      { className: "timeline-details-config-note" },
      "Drag, use ↑ ↓ or Alt+↑/↓ to reorder. Width is chosen automatically."
    ),
    props.catalog.definitionsUnavailable
      ? React.createElement(
          "p",
          { className: "timeline-details-config-note timeline-details-config-warning", role: "status" },
          "Field definitions unavailable – loaded fields are edited as text."
        )
      : null,
    React.createElement("div", { className: "timeline-details-config-divider", "aria-hidden": "true" }),
    React.createElement(
      "p",
      { className: "timeline-details-config-section-title" },
      React.createElement("span", null, "Available")
    ),
    React.createElement("input", {
      type: "search",
      className: "timeline-details-config-search",
      placeholder: "Search field",
      "aria-label": "Search details fields",
      value: search,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)
    }),
    available.length === 0
      ? React.createElement("p", { className: "timeline-details-muted" }, "No matching field.")
      : null,
    React.createElement(
      "ul",
      { className: "timeline-details-config-list timeline-details-config-available", "aria-label": "Available fields" },
      ...available.map((field) =>
        React.createElement(
          "li",
          { key: field.id, className: "timeline-details-config-item" },
          React.createElement(
            "span",
            { className: "timeline-details-config-meta" },
            React.createElement("strong", null, field.name),
            React.createElement("span", null, field.subtitle)
          ),
          React.createElement("span", { className: "timeline-details-config-badges" }, ...renderBadges(field)),
          React.createElement(
            "span",
            { className: "timeline-details-config-actions" },
            iconButton(`Show ${field.name}`, "+", false, () => props.onChangeShownIds([...props.shownIds, field.id]))
          )
        )
      )
    )
  );
}

const DIALOG_VIEWPORT_INSET_PX = 8;
const DIALOG_MIN_HEIGHT_PX = 160;

function resolveDialogMaxHeightPx(dialog: HTMLElement): number {
  const footer = document.querySelector(".ui-shell-footer");
  const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
  const bottomLimit = Math.min(window.innerHeight, footerTop) - DIALOG_VIEWPORT_INSET_PX;
  return Math.max(DIALOG_MIN_HEIGHT_PX, Math.floor(bottomLimit - dialog.getBoundingClientRect().top));
}

function renderBadges(field: DetailsFieldDescriptor | null): React.ReactElement[] {
  if (!field) {
    return [React.createElement("span", { key: "missing", className: "timeline-details-config-badge" }, "Not in current query")];
  }

  const badges = [
    React.createElement("span", { key: "width", className: "timeline-details-config-badge" }, field.width === "half" ? "½" : "Full")
  ];
  if (field.editable) {
    badges.push(
      React.createElement(
        "span",
        { key: "edit", className: "timeline-details-config-badge timeline-details-config-badge-edit" },
        "Edit"
      )
    );
  }
  return badges;
}

function iconButton(label: string, symbol: string, disabled: boolean, onClick: () => void): React.ReactElement {
  return React.createElement(
    "button",
    {
      type: "button",
      className: "timeline-details-config-icon-button",
      "aria-label": label,
      title: label,
      disabled,
      onClick
    },
    symbol
  );
}

function gripIcon(): React.ReactElement {
  return React.createElement(
    "svg",
    { className: "timeline-details-config-grip", viewBox: "0 0 16 16", "aria-hidden": "true" },
    React.createElement(
      "g",
      { fill: "currentColor" },
      ...[
        [6, 4],
        [10, 4],
        [6, 8],
        [10, 8],
        [6, 12],
        [10, 12]
      ].map(([cx, cy]) => React.createElement("circle", { key: `${cx}-${cy}`, cx, cy, r: 1.1 }))
    )
  );
}
