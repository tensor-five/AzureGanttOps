import type { IngestionQueryRelation } from "../../application/dto/ingestion-snapshot.js";
import type { CanonicalModel } from "./canonical-model-builder.js";

export type TreeNodeMeta = {
  workItemId: number;
  depth: number;
  parentWorkItemId: number | null;
  hasChildren: boolean;
  isLastSibling: boolean;
  ancestorIsLastSibling: boolean[];
};

export type TreeLayout = {
  orderedIds: number[];
  metaByWorkItemId: ReadonlyMap<number, TreeNodeMeta>;
};

export function buildTreeLayout(
  canonical: CanonicalModel,
  queryRelations: IngestionQueryRelation[]
): TreeLayout {
  const allIds = new Set(canonical.tasks.map((task) => task.workItemId));
  const childrenByParent = buildChildrenMap(queryRelations, canonical, allIds);
  const roots = childrenByParent.get(null) ?? [];

  const orphanIds = findOrphans(allIds, childrenByParent, roots);
  for (const orphanId of orphanIds) {
    roots.push(orphanId);
  }

  const orderedIds: number[] = [];
  const metaMap = new Map<number, TreeNodeMeta>();
  const visited = new Set<number>();

  dfsTraverse(roots, null, 0, [], childrenByParent, visited, allIds, orderedIds, metaMap);

  return {
    orderedIds,
    metaByWorkItemId: metaMap
  };
}

function buildChildrenMap(
  queryRelations: IngestionQueryRelation[],
  canonical: CanonicalModel,
  allIds: Set<number>
): Map<number | null, number[]> {
  const map = new Map<number | null, number[]>();

  if (queryRelations.length > 0) {
    for (const relation of queryRelations) {
      if (!allIds.has(relation.targetWorkItemId)) {
        continue;
      }

      const parentId = relation.sourceWorkItemId;

      if (parentId !== null && !allIds.has(parentId)) {
        continue;
      }

      const children = map.get(parentId);
      if (children) {
        if (!children.includes(relation.targetWorkItemId)) {
          children.push(relation.targetWorkItemId);
        }
      } else {
        map.set(parentId, [relation.targetWorkItemId]);
      }
    }
  } else {
    const rootIds: number[] = [];

    for (const task of canonical.tasks) {
      if (task.parentWorkItemId === null || !allIds.has(task.parentWorkItemId)) {
        rootIds.push(task.workItemId);
        continue;
      }

      const children = map.get(task.parentWorkItemId);
      if (children) {
        children.push(task.workItemId);
      } else {
        map.set(task.parentWorkItemId, [task.workItemId]);
      }
    }

    map.set(null, rootIds);
  }

  return map;
}

export function buildTreeLayoutFromParentMap(
  items: ReadonlyArray<{ id: number; parentId: number | null }>
): TreeLayout {
  const allIds = new Set(items.map((item) => item.id));
  const childrenByParent = new Map<number | null, number[]>();

  for (const item of items) {
    const parentId = item.parentId !== null && allIds.has(item.parentId) ? item.parentId : null;
    const siblings = childrenByParent.get(parentId);
    if (siblings) {
      siblings.push(item.id);
    } else {
      childrenByParent.set(parentId, [item.id]);
    }
  }

  const roots = childrenByParent.get(null) ?? [];
  const orphanIds = findOrphans(allIds, childrenByParent, roots);
  for (const orphanId of orphanIds) {
    roots.push(orphanId);
  }

  const orderedIds: number[] = [];
  const metaMap = new Map<number, TreeNodeMeta>();
  const visited = new Set<number>();

  dfsTraverse(roots, null, 0, [], childrenByParent, visited, allIds, orderedIds, metaMap);

  return {
    orderedIds,
    metaByWorkItemId: metaMap
  };
}

function findOrphans(
  allIds: Set<number>,
  childrenByParent: Map<number | null, number[]>,
  roots: number[]
): number[] {
  const reachable = new Set<number>();
  const stack = [...roots];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) {
      continue;
    }

    reachable.add(id);
    const children = childrenByParent.get(id);
    if (children) {
      stack.push(...children);
    }
  }

  const orphans: number[] = [];
  for (const id of allIds) {
    if (!reachable.has(id)) {
      orphans.push(id);
    }
  }

  return orphans;
}

function dfsTraverse(
  siblings: number[],
  parentId: number | null,
  depth: number,
  ancestorIsLastSibling: boolean[],
  childrenByParent: Map<number | null, number[]>,
  visited: Set<number>,
  allIds: Set<number>,
  orderedIds: number[],
  metaMap: Map<number, TreeNodeMeta>
): void {
  for (let index = 0; index < siblings.length; index++) {
    const id = siblings[index];

    if (visited.has(id) || !allIds.has(id)) {
      continue;
    }

    visited.add(id);

    const children = childrenByParent.get(id) ?? [];
    const validChildren = children.filter((childId) => !visited.has(childId) && allIds.has(childId));
    const isLast = index === siblings.length - 1;

    metaMap.set(id, {
      workItemId: id,
      depth,
      parentWorkItemId: parentId,
      hasChildren: validChildren.length > 0,
      isLastSibling: isLast,
      ancestorIsLastSibling: [...ancestorIsLastSibling]
    });

    orderedIds.push(id);

    if (validChildren.length > 0) {
      dfsTraverse(
        validChildren,
        id,
        depth + 1,
        [...ancestorIsLastSibling, isLast],
        childrenByParent,
        visited,
        allIds,
        orderedIds,
        metaMap
      );
    }
  }
}
