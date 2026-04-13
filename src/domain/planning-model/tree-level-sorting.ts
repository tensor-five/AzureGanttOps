import type { TreeLayout, TreeNodeMeta } from "./tree-structure.js";

export function applyTreeLevelSorting<T extends { workItemId: number }>(
  items: T[],
  treeLayout: TreeLayout,
  comparator: (a: T, b: T) => number
): { sortedItems: T[]; updatedLayout: TreeLayout } {
  const itemById = new Map<number, T>();
  for (const item of items) {
    itemById.set(item.workItemId, item);
  }

  const childrenByParent = new Map<number | null, number[]>();

  for (const id of treeLayout.orderedIds) {
    const meta = treeLayout.metaByWorkItemId.get(id);
    if (!meta) {
      continue;
    }

    const parentId = meta.parentWorkItemId;
    const siblings = childrenByParent.get(parentId);
    if (siblings) {
      siblings.push(id);
    } else {
      childrenByParent.set(parentId, [id]);
    }
  }

  for (const [parentId, childIds] of childrenByParent) {
    childIds.sort((aId, bId) => {
      const aItem = itemById.get(aId);
      const bItem = itemById.get(bId);
      if (!aItem || !bItem) {
        return 0;
      }

      return comparator(aItem, bItem);
    });
  }

  const sortedItems: T[] = [];
  const updatedMeta = new Map<number, TreeNodeMeta>();
  const orderedIds: number[] = [];

  dfsCollect(null, 0, [], childrenByParent, treeLayout.metaByWorkItemId, itemById, sortedItems, updatedMeta, orderedIds);

  return {
    sortedItems,
    updatedLayout: {
      orderedIds,
      metaByWorkItemId: updatedMeta
    }
  };
}

function dfsCollect<T extends { workItemId: number }>(
  parentId: number | null,
  depth: number,
  ancestorIsLastSibling: boolean[],
  childrenByParent: Map<number | null, number[]>,
  originalMeta: ReadonlyMap<number, TreeNodeMeta>,
  itemById: Map<number, T>,
  sortedItems: T[],
  updatedMeta: Map<number, TreeNodeMeta>,
  orderedIds: number[]
): void {
  const children = childrenByParent.get(parentId);
  if (!children) {
    return;
  }

  for (let index = 0; index < children.length; index++) {
    const id = children[index];
    const original = originalMeta.get(id);
    if (!original) {
      continue;
    }

    const isLast = index === children.length - 1;
    const childChildren = childrenByParent.get(id);
    const hasChildren = childChildren !== undefined && childChildren.length > 0;

    updatedMeta.set(id, {
      workItemId: id,
      depth,
      parentWorkItemId: parentId,
      hasChildren,
      isLastSibling: isLast,
      ancestorIsLastSibling: [...ancestorIsLastSibling]
    });

    orderedIds.push(id);

    const item = itemById.get(id);
    if (item) {
      sortedItems.push(item);
    }

    if (hasChildren) {
      dfsCollect(
        id,
        depth + 1,
        [...ancestorIsLastSibling, isLast],
        childrenByParent,
        originalMeta,
        itemById,
        sortedItems,
        updatedMeta,
        orderedIds
      );
    }
  }
}
