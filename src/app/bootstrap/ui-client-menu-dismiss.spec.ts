// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { dismissOpenDetailsMenus, isTargetInsideElement } from "./ui-client-menu-dismiss.js";

describe("ui-client-menu-dismiss", () => {
  it("closes open details menus when pointer target is outside", () => {
    document.body.innerHTML = `
      <details class="menu-a" open><summary>A</summary><div>A panel</div></details>
      <details class="menu-b" open><summary>B</summary><div>B panel</div></details>
      <button id="outside">Outside</button>
    `;

    const outside = document.getElementById("outside");
    dismissOpenDetailsMenus({ root: document, target: outside });

    expect(document.querySelector(".menu-a")?.hasAttribute("open")).toBe(false);
    expect(document.querySelector(".menu-b")?.hasAttribute("open")).toBe(false);
  });

  it("keeps the active details menu open when clicking inside it", () => {
    document.body.innerHTML = `
      <details class="menu-a" open>
        <summary>A</summary>
        <div><button id="inside-a">Inside A</button></div>
      </details>
      <details class="menu-b" open><summary>B</summary><div>B panel</div></details>
    `;

    const insideA = document.getElementById("inside-a");
    dismissOpenDetailsMenus({ root: document, target: insideA });

    expect(document.querySelector(".menu-a")?.hasAttribute("open")).toBe(true);
    expect(document.querySelector(".menu-b")?.hasAttribute("open")).toBe(false);
  });

  it("does not close menus explicitly opted out of auto-dismiss", () => {
    document.body.innerHTML = `
      <details class="menu-persistent" data-auto-dismiss="off" open><summary>P</summary><div>P panel</div></details>
      <button id="outside">Outside</button>
    `;

    const outside = document.getElementById("outside");
    dismissOpenDetailsMenus({ root: document, target: outside });

    expect(document.querySelector(".menu-persistent")?.hasAttribute("open")).toBe(true);
  });

  it("checks whether target is inside an element", () => {
    document.body.innerHTML = `
      <div id="host"><button id="inside">Inside</button></div>
      <button id="outside">Outside</button>
    `;

    const host = document.getElementById("host");
    const inside = document.getElementById("inside");
    const outside = document.getElementById("outside");

    expect(isTargetInsideElement(inside, host)).toBe(true);
    expect(isTargetInsideElement(outside, host)).toBe(false);
    expect(isTargetInsideElement(null, host)).toBe(false);
    expect(isTargetInsideElement(inside, null)).toBe(false);
  });
});
