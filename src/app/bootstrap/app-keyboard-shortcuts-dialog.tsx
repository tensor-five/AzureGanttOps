import React from "react";

import { AppDialogShell } from "./app-dialog-shell.js";
import { APP_KEYBOARD_SHORTCUT_SECTIONS, type KeyboardShortcut, type KeyboardShortcutSection } from "./app-keyboard-shortcuts.catalog.js";

export type AppKeyboardShortcutsDialogProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function AppKeyboardShortcutsDialog(props: AppKeyboardShortcutsDialogProps): React.ReactElement | null {
  return React.createElement(
    AppDialogShell,
    {
      open: props.open,
      title: "Tastenkombinationen",
      titleId: "app-keyboard-shortcuts-title",
      closeLabel: "Tastenkombinationen schließen",
      onClose: props.onClose,
      returnFocusRef: props.returnFocusRef,
      contentClassName: "app-keyboard-shortcuts-content"
    },
    React.createElement(
      "div",
      { className: "app-keyboard-shortcuts" },
      APP_KEYBOARD_SHORTCUT_SECTIONS.map((section) => renderKeyboardShortcutSection(section))
    )
  );
}

function renderKeyboardShortcutSection(section: KeyboardShortcutSection): React.ReactElement {
  return React.createElement(
    "section",
    { key: section.title, className: "app-keyboard-shortcuts-section", "aria-labelledby": shortcutSectionId(section.title) },
    React.createElement("h3", { id: shortcutSectionId(section.title) }, section.title),
    React.createElement(
      "dl",
      { className: "app-keyboard-shortcuts-list" },
      section.shortcuts.map((shortcut) => renderKeyboardShortcut(shortcut))
    )
  );
}

function renderKeyboardShortcut(shortcut: KeyboardShortcut): React.ReactElement {
  return React.createElement(
    "div",
    { key: `${shortcut.keys.join("|")}:${shortcut.description}`, className: "app-keyboard-shortcut-item" },
    React.createElement(
      "dt",
      { className: "app-keyboard-shortcut-keys" },
      shortcut.keys.map((key) => React.createElement("kbd", { key }, key))
    ),
    React.createElement("dd", { className: "app-keyboard-shortcut-description" }, shortcut.description)
  );
}

function shortcutSectionId(title: string): string {
  return `app-keyboard-shortcuts-${title.toLowerCase().replaceAll(" ", "-")}`;
}
