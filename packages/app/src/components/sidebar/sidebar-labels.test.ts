import { describe, expect, test } from "vitest";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";
import { SIDEBAR_UNLABELLED_LABEL_KEY } from "@/stores/sidebar-view-store";
import { applyStoredOrdering } from "@/hooks/sidebar-workspaces-view-model";
import {
  applyPendingLabelBoardMoves,
  buildLabelBoardItems,
  filterWorkspacesByLabels,
  LABEL_UNLABELLED_GROUP_KEY,
  labelWorkspaceGroups,
  orderLabelsLikeSidebar,
  resolveLabelBoardDrop,
  type LabelBoardItem,
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

describe("label board", () => {
  const definitions = [
    { name: "Doing", color: "amber" as const },
    { name: "Done", color: "emerald" as const },
  ];
  const a = workspace("a", ["Doing"]);
  const b = workspace("b", ["Doing"]);
  const c = workspace("c", ["Done"]);
  const loose = workspace("loose", []);
  const groups = labelWorkspaceGroups({
    workspaces: [a, b, c, loose],
    labelDefinitions: definitions,
    unlabelledLabel: "Unlabelled",
  });
  const neverCollapsed = () => false;

  function itemKeys(items: readonly LabelBoardItem[]): string[] {
    return items.map((item) => item.key);
  }

  function moveItem(items: LabelBoardItem[], from: number, to: number): LabelBoardItem[] {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    return next;
  }

  test("flattens groups into headers followed by their rows, skipping collapsed rows", () => {
    const items = buildLabelBoardItems(groups, (group) => group.key === "label:done");
    expect(itemKeys(items)).toEqual([
      "header:label:doing",
      "label:doing|host:a",
      "label:doing|host:b",
      "header:label:done",
      `header:${LABEL_UNLABELLED_GROUP_KEY}`,
      `${LABEL_UNLABELLED_GROUP_KEY}|host:loose`,
    ]);
  });

  test("a row dropped under another header moves to that label and takes its place there", () => {
    const items = buildLabelBoardItems(groups, neverCollapsed);
    // Drag b from under Doing to just below the Done header, above c.
    const dropped = moveItem(items, 2, 3);
    const drop = resolveLabelBoardDrop(dropped);

    expect(drop.moves).toEqual([
      { workspace: b, fromGroupKey: "label:doing", toGroupKey: "label:done" },
    ]);
    expect(drop.rowOrderByGroup.get("label:done")).toEqual(["host:b", "host:c"]);
    expect(drop.rowOrderByGroup.get("label:doing")).toEqual(["host:a"]);
  });

  test("reordering within a group is not a move", () => {
    const items = buildLabelBoardItems(groups, neverCollapsed);
    const drop = resolveLabelBoardDrop(moveItem(items, 2, 1));
    expect(drop.moves).toEqual([]);
    expect(drop.rowOrderByGroup.get("label:doing")).toEqual(["host:b", "host:a"]);
  });

  test("a row dropped above every header belongs to the first group", () => {
    const items = buildLabelBoardItems(groups, neverCollapsed);
    const drop = resolveLabelBoardDrop(moveItem(items, 4, 0));
    expect(drop.moves).toEqual([
      { workspace: c, fromGroupKey: "label:done", toGroupKey: "label:doing" },
    ]);
  });

  test("pending moves show the row under its new header in the stored order", () => {
    const displayed = applyPendingLabelBoardMoves({
      groups,
      moves: [{ workspace: b, fromGroupKey: "label:doing", toGroupKey: "label:done" }],
      workspaceOrderByLabelGroup: { "label:done": ["host:b", "host:c"] },
    });
    const rowsOf = (key: string) =>
      displayed.find((group) => group.key === key)?.rows.map((row) => row.workspaceId);
    expect(rowsOf("label:doing")).toEqual(["a"]);
    expect(rowsOf("label:done")).toEqual(["b", "c"]);
  });
});
