import { describe, expect, test } from "vitest";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";
import { SIDEBAR_UNLABELLED_LABEL_KEY } from "@/stores/sidebar-view-store";
import { applyStoredOrdering } from "@/hooks/sidebar-workspaces-view-model";
import {
  filterWorkspacesByLabels,
  labelWorkspaceGroups,
  orderLabelsLikeSidebar,
} from "./sidebar-labels";

function workspace(
  workspaceId: string,
  labels: string[],
  pinnedAt: string | null = null,
): SidebarWorkspaceEntry {
  return {
    workspaceKey: `host:${workspaceId}`,
    serverId: "host",
    workspaceId,
    projectViewKey: "project",
    projectName: "Project",
    projectRootPath: "/repo",
    workspaceDirectory: `/repo/${workspaceId}`,
    workspaceDirectoryLabel: workspaceId,
    projectKind: "git",
    workspaceKind: "worktree",
    name: workspaceId,
    title: null,
    pinnedAt,
    labels,
    currentBranch: "main",
    statusBucket: "done",
    statusEnteredAt: null,
    archivingAt: null,
    diffStat: null,
    prHint: null,
    archiveHasUncommittedChanges: null,
    archiveUnpushedCommitCount: null,
    scripts: [],
    hasRunningScripts: false,
  };
}

describe("sidebar label filtering", () => {
  const workspaces = [
    workspace("one", ["Backend", "Urgent"], "2026-01-01"),
    workspace("two", ["Backend"]),
    workspace("three", []),
  ];

  function filtered(labels: string[]) {
    return filterWorkspacesByLabels({ workspaces, labels }).map((entry) => entry.workspaceId);
  }

  test("includes a workspace carrying any selected label", () => {
    expect(filtered([])).toEqual(["one", "two", "three"]);
    expect(filtered(["backend"])).toEqual(["one", "two"]);
    expect(filtered(["backend", "urgent"])).toEqual(["one", "two"]);
  });

  test("models Unlabelled as a row in the same list", () => {
    expect(filtered([SIDEBAR_UNLABELLED_LABEL_KEY])).toEqual(["three"]);
    expect(filtered(["backend", SIDEBAR_UNLABELLED_LABEL_KEY])).toEqual(["one", "two", "three"]);
  });

  test("reads whitespace-only label names as no label rather than as the Unlabelled key", () => {
    expect(
      filterWorkspacesByLabels({
        workspaces: [workspace("blank", ["   "])],
        labels: [SIDEBAR_UNLABELLED_LABEL_KEY],
      }).map((entry) => entry.workspaceId),
    ).toEqual(["blank"]);
  });
});

describe("orderLabelsLikeSidebar", () => {
  const labels = [
    { name: "In Review", color: "violet" as const },
    { name: "Backlog", color: "violet" as const },
    { name: "To Do", color: "violet" as const },
    { name: "In Progress", color: "violet" as const },
    { name: "Done", color: "violet" as const },
  ];

  test("matches the sidebar's label group order, including a manual drag order", () => {
    const labelGroupOrder = ["label:done", "label:in review", "label:in progress", "label:to do"];
    const sidebarOrder = applyStoredOrdering({
      items: labelWorkspaceGroups({
        workspaces: [],
        labelDefinitions: labels,
        unlabelledLabel: "Unlabelled",
      }),
      storedOrder: labelGroupOrder,
      getKey: (group) => group.key,
    }).map((group) => group.label);

    const listOrder = orderLabelsLikeSidebar(labels, labelGroupOrder).map((label) => label.name);

    expect(listOrder).toEqual(["Backlog", "Done", "In Review", "In Progress", "To Do"]);
    expect(listOrder).toEqual(sidebarOrder);
  });

  test("falls back to alphabetical with no stored order", () => {
    expect(orderLabelsLikeSidebar(labels, []).map((label) => label.name)).toEqual([
      "Backlog",
      "Done",
      "In Progress",
      "In Review",
      "To Do",
    ]);
  });
});
