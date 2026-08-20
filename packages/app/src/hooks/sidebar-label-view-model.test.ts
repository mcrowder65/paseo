import { describe, expect, it } from "vitest";
import type { WorkspaceLabelDefinition } from "@getpaseo/protocol/workspace-labels";
import { buildLabelGroups } from "./sidebar-label-view-model";
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
    statusEnteredAt: null,
    archivingAt: null,
    diffStat: null,
    prHint: null,
    archiveHasUncommittedChanges: null,
    archiveUnpushedCommitCount: null,
    scripts: [],
    hasRunningScripts: false,
    labels: [],
    ...input,
  };
}

const NAMES = new Map<string, string>([["project", "Project"]]);
const LABELS: WorkspaceLabelDefinition[] = [
  { name: "Urgent", color: "red" },
  { name: "Backend", color: "sky" },
];

describe("buildLabelGroups", () => {
  it("files each workspace under every label it carries, in catalog order by default", () => {
    const groups = buildLabelGroups(
      [
        ws({ workspaceKey: "both", labels: ["Urgent", "Backend"] }),
        ws({ workspaceKey: "backend-only", labels: ["Backend"] }),
      ],
      LABELS,
      [],
      NAMES,
    );
    expect(groups.map((group) => group.label)).toEqual(["Urgent", "Backend"]);
    expect(groups[0]?.rows.map((row) => row.workspaceKey)).toEqual(["both"]);
    expect(groups[1]?.rows.map((row) => row.workspaceKey)).toEqual(["backend-only", "both"]);
    expect(groups[0]?.color).toBe("red");
  });

  it("orders columns by the saved order, then remaining labels in catalog order", () => {
    const groups = buildLabelGroups(
      [
        ws({ workspaceKey: "u", labels: ["Urgent"] }),
        ws({ workspaceKey: "b", labels: ["Backend"] }),
      ],
      LABELS,
      ["backend"],
      NAMES,
    );
    expect(groups.map((group) => group.label)).toEqual(["Backend", "Urgent"]);
  });

  it("keeps Unlabelled last regardless of saved order", () => {
    const groups = buildLabelGroups(
      [ws({ workspaceKey: "u", labels: ["Urgent"] }), ws({ workspaceKey: "n", labels: [] })],
      LABELS,
      ["urgent"],
      NAMES,
    );
    expect(groups.map((group) => group.label)).toEqual(["Urgent", "Backend", "Unlabelled"]);
  });

  it("shows a column for every catalog label, even one nothing carries", () => {
    const groups = buildLabelGroups(
      [ws({ workspaceKey: "b", labels: ["Backend"] })],
      LABELS,
      ["urgent", "backend"],
      NAMES,
    );
    expect(groups.map((group) => group.label)).toEqual(["Urgent", "Backend"]);
    expect(groups[0]?.rows).toEqual([]);
  });

  it("collects workspaces with no real label into a trailing Unlabelled group", () => {
    const groups = buildLabelGroups(
      [
        ws({ workspaceKey: "labelled", labels: ["Urgent"] }),
        ws({ workspaceKey: "blank", labels: ["   "] }),
        ws({ workspaceKey: "none", labels: [] }),
      ],
      LABELS,
      [],
      NAMES,
    );
    const last = groups.at(-1);
    expect(last?.label).toBe("Unlabelled");
    expect(last?.color).toBeNull();
    expect(last?.rows.map((row) => row.workspaceKey)).toEqual(["blank", "none"]);
  });

  it("matches labels case-insensitively against the catalog", () => {
    const groups = buildLabelGroups(
      [ws({ workspaceKey: "a", labels: ["urgent"] })],
      LABELS,
      [],
      NAMES,
    );
    const urgent = groups.find((group) => group.label === "Urgent");
    expect(urgent?.rows.map((row) => row.workspaceKey)).toEqual(["a"]);
  });
});
