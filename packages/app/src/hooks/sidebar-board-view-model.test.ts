import { describe, expect, it } from "vitest";
import { WORKSPACE_MANUAL_STATUS_ORDER } from "@getpaseo/protocol/workspace-status";
import { buildBoardGroups, effectiveWorkspaceManualStatus } from "./sidebar-board-view-model";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";

function ws(
  input: Partial<SidebarWorkspaceEntry> & { workspaceKey: string },
): SidebarWorkspaceEntry {
  return {
    serverId: "srv",
    workspaceId: input.workspaceKey,
    projectViewKey: "project",
    projectName: "Project",
    workspaceDirectory: "",
    workspaceDirectoryLabel: "",
    projectKind: "git",
    workspaceKind: "worktree",
    name: input.workspaceKey,
    title: null,
    currentBranch: null,
    statusBucket: "done",
    manualStatus: null,
    statusEnteredAt: null,
    archivingAt: null,
    diffStat: null,
    prHint: null,
    archiveHasUncommittedChanges: null,
    archiveUnpushedCommitCount: null,
    scripts: [],
    hasRunningScripts: false,
    ...input,
  };
}

const NAMES = new Map<string, string>([["project", "Project"]]);

describe("effectiveWorkspaceManualStatus", () => {
  it("prefers a manual status over the derived bucket", () => {
    expect(
      effectiveWorkspaceManualStatus(
        ws({ workspaceKey: "a", manualStatus: "done", statusBucket: "running" }),
      ),
    ).toBe("done");
  });

  it("puts unfiled workspaces in the default column regardless of activity", () => {
    for (const statusBucket of ["running", "needs_input", "done", "failed", "attention"] as const) {
      expect(effectiveWorkspaceManualStatus(ws({ workspaceKey: statusBucket, statusBucket }))).toBe(
        "in_progress",
      );
    }
  });
});

describe("buildBoardGroups", () => {
  it("always returns every column, in board order, even when empty", () => {
    const groups = buildBoardGroups([], NAMES);
    expect(groups.map((group) => group.status)).toEqual([...WORKSPACE_MANUAL_STATUS_ORDER]);
    expect(groups.every((group) => group.rows.length === 0)).toBe(true);
  });

  it("files rows by manual status, and unfiled rows into the default column", () => {
    const groups = buildBoardGroups(
      [
        ws({ workspaceKey: "canceled-ws", manualStatus: "canceled", statusBucket: "running" }),
        ws({ workspaceKey: "backlog-ws", manualStatus: "backlog", statusBucket: "running" }),
        ws({ workspaceKey: "unfiled-ws", statusBucket: "done" }),
      ],
      NAMES,
    );
    const byStatus = new Map(groups.map((group) => [group.status, group.rows]));
    expect(byStatus.get("canceled")?.map((row) => row.workspaceKey)).toEqual(["canceled-ws"]);
    expect(byStatus.get("backlog")?.map((row) => row.workspaceKey)).toEqual(["backlog-ws"]);
    expect(byStatus.get("in_progress")?.map((row) => row.workspaceKey)).toEqual(["unfiled-ws"]);
  });
});
