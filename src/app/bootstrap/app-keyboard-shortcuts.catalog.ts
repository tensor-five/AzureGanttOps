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
  title: "Allgemein" | "Timeline" | "Work Items";
  shortcuts: readonly KeyboardShortcut[];
};

export const APP_KEYBOARD_SHORTCUT_SECTIONS = [
  {
    title: "Allgemein",
    shortcuts: [
      {
        contract: "details.save-or-sync",
        keys: ["Strg/Cmd+S"],
        description: "Geänderte Details speichern oder ausstehende Work-Item-Änderungen synchronisieren"
      },
      {
        contract: "timeline.print-current-view",
        keys: ["Strg/Cmd+P"],
        description: "Aktuelle Timeline-Ansicht drucken"
      },
      {
        contract: "overlays.close-active",
        keys: ["Escape"],
        description: "Offene Header-Dialoge, Timeline-Menüs und Panels schließen"
      }
    ]
  },
  {
    title: "Timeline",
    shortcuts: [
      {
        contract: "timeline.refresh-query",
        keys: ["R"],
        description: "Aktuelle Query neu laden, wenn gerade kein Refresh läuft"
      },
      {
        contract: "timeline.toggle-filters",
        keys: ["F"],
        description: "Timeline-Filter öffnen oder schließen"
      },
      {
        contract: "timeline.toggle-sort",
        keys: ["S"],
        description: "Sortierung öffnen oder schließen"
      },
      {
        contract: "timeline.toggle-labels",
        keys: ["L"],
        description: "Label-Anzeige umschalten"
      },
      {
        contract: "timeline.rotate-dependency-mode",
        keys: ["D"],
        description: "Abhängigkeitsmodus wechseln"
      },
      {
        contract: "timeline.zoom-month-week-quarter-year",
        keys: ["M", "W", "Q", "Y"],
        description: "Zoom auf Monat, Woche, Quartal oder Jahr setzen"
      },
      {
        contract: "timeline.space-pan",
        keys: ["Leertaste"],
        description: "Gedrückt halten und ziehen, um die Timeline zu verschieben"
      },
      {
        contract: "timeline.pointer-wheel-zoom",
        keys: ["Strg/Cmd+Mausrad"],
        description: "Um die Mausposition zoomen"
      },
      {
        contract: "timeline.remove-selected-dependency",
        keys: ["Entf", "Rücktaste"],
        description: "Ausgewählte Abhängigkeit entfernen, sofern eine markiert ist"
      }
    ]
  },
  {
    title: "Work Items",
    shortcuts: [
      {
        contract: "work-item.focused-select",
        keys: ["Enter", "Leertaste"],
        description: "Fokussiertes Work Item auswählen"
      },
      {
        contract: "work-item.open-context-menu",
        keys: ["Umschalt+F10", "Menü"],
        description: "Kontextmenü am fokussierten Work Item öffnen"
      },
      {
        contract: "menu.navigate",
        keys: ["Pfeiltasten", "Pos1", "Ende"],
        description: "Im Kontextmenü und seinen Untermenüs navigieren"
      },
      {
        contract: "menu.activate-action",
        keys: ["Enter", "Leertaste"],
        description: "Fokussierte Kontextmenü-Aktion ausführen"
      }
    ]
  }
] as const satisfies readonly KeyboardShortcutSection[];
