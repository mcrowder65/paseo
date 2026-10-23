import { describe, expect, test } from "vitest";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";
import { SIDEBAR_UNLABELLED_LABEL_KEY } from "@/stores/sidebar-view-store";
import {
  filterWorkspacesByLabels,
  labelWorkspaceGroups,
  selectGroupLabelDefinitions,
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
    createdAt: null,
    lastUserMessageAt: null,
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

function groupRowIds(group: { rows: readonly SidebarWorkspaceEntry[] }): string[] {
  return group.rows.map((row) => row.workspaceId);
}

describe("labelWorkspaceGroups", () => {
  test("follows the catalog order, then labels the catalog lacks, then Unlabelled", () => {
    const groups = labelWorkspaceGroups({
      workspaces: [
        workspace("stray", ["Zeta", "alpha"]),
        workspace("plain", []),
        workspace("done", ["Done"]),
      ],
      labelDefinitions: [
        { name: "Done", color: "emerald" },
        { name: "Backlog", color: "sky" },
      ],
      unlabelledLabel: "Unlabelled",
      workspaceSort: undefined,
      labelFilter: { labels: [] },
    });

    expect(groups.map((group) => group.label)).toEqual([
      "Done",
      "Backlog",
      "alpha",
      "Zeta",
      "Unlabelled",
    ]);
    expect(groups.map(groupRowIds)).toEqual([["done"], [], ["stray"], ["stray"], ["plain"]]);
    expect(groups[2]?.leading).toEqual({ kind: "label", color: null });
  });

  test("an active label filter keeps only the selected label groups", () => {
    const groups = labelWorkspaceGroups({
      workspaces: [workspace("both", ["Urgent", "Backend"])],
      labelDefinitions: [
        { name: "Backend", color: "sky" },
        { name: "Urgent", color: "red" },
      ],
      unlabelledLabel: "Unlabelled",
      workspaceSort: undefined,
      labelFilter: { labels: ["urgent"] },
    });

    expect(groups.map((group) => group.label)).toEqual(["Urgent"]);
    expect(groups[0]?.leading).toEqual({ kind: "label", color: "red" });
  });
});

describe("selectGroupLabelDefinitions", () => {
  test("keeps only labels from hosts in view", () => {
    const urgent = { name: "Urgent", color: "red" as const };
    const backend = { name: "Backend", color: "sky" as const };
    expect(
      selectGroupLabelDefinitions({
        labels: [urgent, backend],
        hosts: [
          { serverId: "host-a", labels: [urgent] },
          { serverId: "host-b", labels: [backend] },
        ],
        serverIds: ["host-a"],
      }),
    ).toEqual([urgent]);
  });
});
