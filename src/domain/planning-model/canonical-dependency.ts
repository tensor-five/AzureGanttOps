export type CanonicalDependency = {
  predecessorWorkItemId: number;
  successorWorkItemId: number;
  relationType: "System.LinkTypes.Dependency-Forward" | "System.LinkTypes.Dependency-Reverse";
  dependencyType: "FS";
};
