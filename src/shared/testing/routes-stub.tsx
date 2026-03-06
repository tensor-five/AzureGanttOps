import React from "react";
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject
} from "react-router";
import { render, type RenderResult } from "@testing-library/react";

export type RoutesStubOptions = {
  initialEntries?: string[];
  initialIndex?: number;
};

export function createRoutesStub(
  routes: RouteObject[],
  options?: RoutesStubOptions
): RenderResult {
  const router = createMemoryRouter(routes, {
    initialEntries: options?.initialEntries ?? ["/"],
    initialIndex: options?.initialIndex ?? 0
  });

  return render(React.createElement(RouterProvider, { router }));
}
