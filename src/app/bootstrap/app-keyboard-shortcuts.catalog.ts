export type KeyboardShortcutFeatureContract =
  | "details.save-or-sync"
  | "timeline.print-current-view"
  | "overlays.close-active"
  | "timeline.refresh-query"
  | "timeline.toggle-filters"
  | "timeline.toggle-sort"
  | "timeline.toggle-labels"
  | "timeline.rotate-dependency-mode"
  | "timeline.zoom-month-week-quarter-year"
  | "timeline.space-pan"
  | "timeline.pointer-wheel-zoom"
  | "timeline.remove-selected-dependency"
  | "work-item.focused-select"
  | "work-item.open-context-menu"
  | "menu.navigate"
  | "menu.activate-action";

export type KeyboardShortcut = {
  contract: KeyboardShortcutFeatureContract;
  keys: readonly string[];
  description: string;
};

export type KeyboardShortcutSection = {
  title: "General" | "Timeline" | "Work Items";
  shortcuts: readonly KeyboardShortcut[];
};

export const APP_KEYBOARD_SHORTCUT_SECTIONS = [
  {
    title: "General",
    shortcuts: [
      {
        contract: "details.save-or-sync",
        keys: ["Ctrl/Cmd+S"],
        description: "Save changed details or sync pending work item changes"
      },
      {
        contract: "timeline.print-current-view",
        keys: ["Ctrl/Cmd+P"],
        description: "Print the current timeline view"
      },
      {
        contract: "overlays.close-active",
        keys: ["Escape"],
        description: "Close open header dialogs, timeline menus, and panels"
      }
    ]
  },
  {
    title: "Timeline",
    shortcuts: [
      {
        contract: "timeline.refresh-query",
        keys: ["R"],
        description: "Refresh the current query when no refresh is already running"
      },
      {
        contract: "timeline.toggle-filters",
        keys: ["F"],
        description: "Open or close timeline filters"
      },
      {
        contract: "timeline.toggle-sort",
        keys: ["S"],
        description: "Open or close sorting"
      },
      {
        contract: "timeline.toggle-labels",
        keys: ["L"],
        description: "Toggle label display"
      },
      {
        contract: "timeline.rotate-dependency-mode",
        keys: ["D"],
        description: "Switch dependency mode"
      },
      {
        contract: "timeline.zoom-month-week-quarter-year",
        keys: ["M", "W", "Q", "Y"],
        description: "Set zoom to month, week, quarter, or year"
      },
      {
        contract: "timeline.space-pan",
        keys: ["Space"],
        description: "Hold and drag to pan the timeline"
      },
      {
        contract: "timeline.pointer-wheel-zoom",
        keys: ["Ctrl/Cmd+Mouse wheel"],
        description: "Zoom around the pointer position"
      },
      {
        contract: "timeline.remove-selected-dependency",
        keys: ["Delete", "Backspace"],
        description: "Remove the selected dependency when one is selected"
      }
    ]
  },
  {
    title: "Work Items",
    shortcuts: [
      {
        contract: "work-item.focused-select",
        keys: ["Enter", "Space"],
        description: "Select the focused work item"
      },
      {
        contract: "work-item.open-context-menu",
        keys: ["Shift+F10", "Menu"],
        description: "Open the context menu for the focused work item"
      },
      {
        contract: "menu.navigate",
        keys: ["Arrow keys", "Home", "End"],
        description: "Navigate the context menu and its submenus"
      },
      {
        contract: "menu.activate-action",
        keys: ["Enter", "Space"],
        description: "Run the focused context menu action"
      }
    ]
  }
] as const satisfies readonly KeyboardShortcutSection[];
