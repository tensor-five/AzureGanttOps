// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_VERSION, CHANGELOG_PATH } from "../../shared/project-meta/project-meta.js";
import { AppChangelogDialog } from "./app-changelog-dialog.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AppChangelogDialog", () => {
  it("renders nothing and does not fetch while closed", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(React.createElement(AppChangelogDialog, { open: false, onClose: vi.fn() }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads markdown with no-store cache headers and renders headings, lists and inline code", async () => {
    const fetchMock = stubMarkdownFetch(`# Produktnotizen

## Neu

- Rendert \`Markdown\` sicher
`);

    render(React.createElement(AppChangelogDialog, { open: true, onClose: vi.fn() }));

    const dialog = screen.getByRole("dialog", { name: `Changelog v${APP_VERSION}` });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Changelog wird geladen...");

    expect(await screen.findByRole("heading", { name: "Produktnotizen", level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Neu", level: 2 })).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toContain("Rendert Markdown sicher");
    expect(screen.getByText("Markdown").tagName).toBe("CODE");
    expect(screen.queryByRole("note", { name: "Neue Version verfügbar" })).toBeNull();

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(fetchMock).toHaveBeenCalledWith(CHANGELOG_PATH, expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal)
    }));
    expect(init.headers).toEqual({ accept: "text/markdown" });
  });

  it("renders an optional update notice above the changelog", async () => {
    stubMarkdownFetch("# Changelog");

    render(
      React.createElement(AppChangelogDialog, {
        open: true,
        onClose: vi.fn(),
        updateNotice: {
          currentVersion: "1.8.3",
          latestVersion: "1.9.0",
          checkedAt: "2026-06-27T10:00:00.000Z",
          source: "github"
        }
      })
    );

    const notice = screen.getByRole("note", { name: "Neue Version verfügbar" });
    expect(notice.textContent).toContain("Installiert ist v1.8.3, verfügbar ist v1.9.0.");
    expect(notice.textContent).toContain("git pull");
    expect(notice.textContent).toContain(".cmd");
    expect(notice.textContent).toContain(".command");
    expect(notice.textContent).toContain("Strg+Shift+R");
    expect(await screen.findByRole("heading", { name: "Changelog" })).toBeTruthy();
  });

  it("shows an alert when the changelog request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("kaputt", { status: 503 }))
    );

    render(React.createElement(AppChangelogDialog, { open: true, onClose: vi.fn() }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Changelog konnte nicht geladen werden.");
    expect(alert.textContent).toContain("503");
  });

  it("aborts a closed load and ignores its late response after reopening", async () => {
    const firstResponse = createDeferred<Response>();
    const secondResponse = createDeferred<Response>();
    let requestCount = 0;
    const fetchMock = vi.fn((_url: string, _init: RequestInit) => {
      requestCount += 1;
      return requestCount === 1 ? firstResponse.promise : secondResponse.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      React.createElement(AppChangelogDialog, { open: true, onClose: vi.fn() })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const firstSignal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal;
    expect(firstSignal).toBeInstanceOf(AbortSignal);

    rerender(React.createElement(AppChangelogDialog, { open: false, onClose: vi.fn() }));
    expect(firstSignal?.aborted).toBe(true);

    rerender(React.createElement(AppChangelogDialog, { open: true, onClose: vi.fn() }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondResponse.resolve(new Response("# Zweite Antwort", { status: 200 }));
      await secondResponse.promise;
    });
    expect(await screen.findByRole("heading", { name: "Zweite Antwort" })).toBeTruthy();

    await act(async () => {
      firstResponse.resolve(new Response("# Erste Antwort", { status: 200 }));
      await firstResponse.promise;
      await Promise.resolve();
    });

    expect(screen.getByRole("heading", { name: "Zweite Antwort" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Erste Antwort" })).toBeNull();
  });

  it("closes on Escape", async () => {
    stubMarkdownFetch("# Changelog");
    render(React.createElement(ClosableDialogHarness));

    fireEvent.click(screen.getByRole("button", { name: "Changelog öffnen" }));
    expect(await screen.findByRole("dialog", { name: `Changelog v${APP_VERSION}` })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: `Changelog v${APP_VERSION}` })).toBeNull();
    });
  });

  it("closes on backdrop clicks without closing on inner dialog clicks", async () => {
    stubMarkdownFetch("# Changelog");
    render(React.createElement(ClosableDialogHarness));

    fireEvent.click(screen.getByRole("button", { name: "Changelog öffnen" }));
    const dialog = await screen.findByRole("dialog", { name: `Changelog v${APP_VERSION}` });

    fireEvent.click(dialog);
    expect(screen.getByRole("dialog", { name: `Changelog v${APP_VERSION}` })).toBeTruthy();

    const backdrop = screen.getByTestId("app-dialog-backdrop");
    expect(backdrop.classList.contains("app-changelog-backdrop")).toBe(true);
    expect(dialog.classList.contains("app-changelog-dialog")).toBe(true);

    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: `Changelog v${APP_VERSION}` })).toBeNull();
    });
  });

  it("closes through the X button and returns focus to the badge", async () => {
    stubMarkdownFetch("# Changelog");
    render(React.createElement(ClosableDialogHarness));

    const trigger = screen.getByRole("button", { name: "Changelog öffnen" });
    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = await screen.findByRole("button", { name: "Changelog schließen" });
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: `Changelog v${APP_VERSION}` })).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("traps Tab and Shift+Tab focus inside the dialog", async () => {
    stubMarkdownFetch("[Dokumentation](https://example.test/docs)");
    render(React.createElement(AppChangelogDialog, { open: true, onClose: vi.fn() }));

    const dialog = await screen.findByRole("dialog", { name: `Changelog v${APP_VERSION}` });
    const closeButton = screen.getByRole("button", { name: "Changelog schließen" });
    const link = await screen.findByRole("link", { name: "Dokumentation" });

    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(link);

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
  });

  it("drops raw HTML, unsafe links and rendered images from markdown output", async () => {
    stubMarkdownFetch(`# Sicher

[Sicherer Link](https://example.test)
[Lokaler Link](/CHANGELOG.md)
[Hash Link](#top)
[Javascript Link](javascript:alert(1))
[Relativer Link](docs/changelog)
<strong>Raw HTML</strong>
<script>alert("xss")</script>
![Screenshot](https://example.test/image.png)
`);
    const { container } = render(
      React.createElement(AppChangelogDialog, { open: true, onClose: vi.fn() })
    );

    expect(await screen.findByRole("heading", { name: "Sicher" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sicherer Link" }).getAttribute("href")).toBe("https://example.test");
    expect(screen.getByRole("link", { name: "Lokaler Link" }).getAttribute("href")).toBe("/CHANGELOG.md");
    expect(screen.getByRole("link", { name: "Hash Link" }).getAttribute("href")).toBe("#top");

    expect(screen.getByText("Javascript Link").closest("a")).toBeNull();
    expect(screen.getByText("Relativer Link").closest("a")).toBeNull();
    expect(container.querySelector("strong")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Bild entfernt: Screenshot")).toBeTruthy();
  });
});

function stubMarkdownFetch(markdown: string) {
  const fetchMock = vi.fn(async () => new Response(markdown, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function ClosableDialogHarness(): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "button",
      {
        ref: triggerRef,
        type: "button",
        onClick: () => setOpen(true)
      },
      "Changelog öffnen"
    ),
    React.createElement(AppChangelogDialog, {
      open,
      onClose: () => setOpen(false),
      returnFocusRef: triggerRef
    })
  );
}
