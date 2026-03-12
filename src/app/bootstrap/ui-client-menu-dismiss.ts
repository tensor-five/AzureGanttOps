export function dismissOpenDetailsMenus(params: {
  root: ParentNode;
  target: Node | null;
}): void {
  const openDetails = Array.from(params.root.querySelectorAll<HTMLDetailsElement>("details[open]"));
  const activeDetails = params.target instanceof Element ? params.target.closest("details") : null;

  for (const detail of openDetails) {
    if (detail.dataset.autoDismiss === "off") {
      continue;
    }

    if (activeDetails && (detail === activeDetails || detail.contains(activeDetails) || activeDetails.contains(detail))) {
      continue;
    }

    detail.open = false;
  }
}

export function isTargetInsideElement(target: Node | null, element: Element | null): boolean {
  if (!target || !element) {
    return false;
  }

  return element.contains(target);
}
