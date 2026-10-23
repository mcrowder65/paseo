import { i18n } from "@/i18n/i18next";
import { describe, expect, it } from "vitest";
import type {
  SidebarProjectEntry,
  SidebarWorkspaceEntry,
  SidebarWorkspacePlacement,
} from "@/hooks/use-sidebar-workspaces-list";
import type { WorkspaceSort } from "@/projects/workspace-structure";
import { buildSidebarProjection } from "./sidebar-projection";

function makeWorkspace(
  id: string,
  statusBucket: SidebarWorkspaceEntry["statusBucket"] = "done",
  labels: string[] = [],
  projectViewKey = "project",
) {
  const placement: SidebarWorkspacePlacement = {
    workspaceKey: `srv:${id}`,
    serverId: "srv",
    workspaceId: id,
    projectViewKey,
    projectName: "Project",
    projectKind: "git",
    workspaceKind: "worktree",
    name: id,
  };
  const entry: SidebarWorkspaceEntry = {
    ...placement,
    workspaceDirectory: "",
    workspaceDirectoryLabel: "",
    title: null,
    currentBranch: null,
    statusBucket,
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
    labels,
  };
  return { placement, entry };
}

function makeProject(
  workspaces: SidebarWorkspacePlacement[],
  viewKey = "project",
): SidebarProjectEntry {
  return {
    viewKey,
    projectName: "Project",
    projectKind: "git",
    iconWorkingDir: `/repo/${viewKey}`,
    hosts: [
      {
        serverId: "srv",
        projectId: viewKey,
        iconWorkingDir: `/repo/${viewKey}`,
        worktreeSupport: "supported" as const,
      },
    ],
    workspaces,
  };
}

function projectionInput(options?: {
  groupMode?: "project" | "status" | "label";
  pinnedCollapsed?: boolean;
}) {
  const pinned = makeWorkspace("pinned", "running");
  const unpinned = makeWorkspace("unpinned", "needs_input");
  return {
    projects: [makeProject([pinned.placement, unpinned.placement])],
    pinnedKeys: {
      pinnedWorkspaceKeys: [pinned.placement.workspaceKey],
      pinnedAtByKey: { [pinned.placement.workspaceKey]: "2026-07-12T12:00:00.000Z" },
    },
    pinnedWorkspaceOrder: [],
    workspaceEntriesByKey: new Map([
      [pinned.entry.workspaceKey, pinned.entry],
      [unpinned.entry.workspaceKey, unpinned.entry],
    ]),
    projectNamesByViewKey: new Map([["project", "Project"]]),
    groupMode: options?.groupMode ?? ("project" as const),
    labelDefinitions: [
      { name: "Backend", color: "blue" as const },
      { name: "Urgent", color: "red" as const },
    ],
    workspaceSort: undefined as WorkspaceSort | undefined,
    labelFilter: { labels: [] as string[] },
    pinnedCollapsed: options?.pinnedCollapsed ?? false,
    collapsedProjectKeys: new Set<string>(),
    collapsedWorkspaceGroupKeys: new Set<string>(),
    t: i18n.t,
  };
}

/**
 * Two projects, one workspace each, both labelled — so every grouping mode puts rows from more
 * than one project on screen, and a mode that asked for fewer icons than it renders would show it.
 */
function twoProjectInput(groupMode: "project" | "status" | "label") {
  const first = makeWorkspace("first", "running", ["Urgent"], "project");
  const second = makeWorkspace("second", "needs_input", ["Backend"], "other-project");
  return {
    ...projectionInput({ groupMode }),
    projects: [makeProject([first.placement]), makeProject([second.placement], "other-project")],
    pinnedKeys: { pinnedWorkspaceKeys: [], pinnedAtByKey: {} },
    workspaceEntriesByKey: new Map([
      [first.entry.workspaceKey, first.entry],
      [second.entry.workspaceKey, second.entry],
    ]),
    projectNamesByViewKey: new Map([
      ["project", "Project"],
      ["other-project", "Other project"],
    ]),
  };
}

describe("buildSidebarProjection", () => {
  // The rule that outlived the bug it was written for: a project icon is fetched per project, so
  // whatever a mode groups by, the rows it produces can only reference projects already covered.
  for (const groupMode of ["project", "status", "label"] as const) {
    it(`covers every row ${groupMode} grouping renders with a project icon target`, () => {
      const projection = buildSidebarProjection(twoProjectInput(groupMode));
      const covered = new Set(projection.projectIconTargets.map((target) => target.projectViewKey));

      // Every leading visual the sidebar can paint from this projection: pinned rows, grouped
      // rows, project headers and the rows under them.
      const renderedProjectViewKeys = new Set<string>();
      for (const entry of projection.pinnedGroups.pinnedChats) {
        renderedProjectViewKeys.add(entry.projectViewKey);
      }
      for (const group of projection.workspaceGroups) {
        for (const entry of group.rows) renderedProjectViewKeys.add(entry.projectViewKey);
      }
      for (const project of projection.pinnedGroups.unpinnedProjects) {
        renderedProjectViewKeys.add(project.viewKey);
        for (const entry of project.workspaces) renderedProjectViewKeys.add(entry.projectViewKey);
      }

      expect([...renderedProjectViewKeys].sort()).toEqual(["other-project", "project"]);
      expect([...renderedProjectViewKeys].filter((viewKey) => !covered.has(viewKey))).toEqual([]);
    });
  }

  it("uses one pin-aware projection for project rows and shortcut order", () => {
    const projection = buildSidebarProjection(projectionInput());

    expect(projection.pinnedGroups.pinnedChats.map((entry) => entry.workspaceId)).toEqual([
      "pinned",
    ]);
    const remainingProject = projection.pinnedGroups.unpinnedProjects[0];
    expect(remainingProject?.workspaces.map((entry) => entry.workspaceId)).toEqual(["unpinned"]);
    expect(projection.shortcutModel.shortcutTargets).toEqual([
      { serverId: "srv", workspaceId: "pinned" },
      { serverId: "srv", workspaceId: "unpinned" },
    ]);
  });

  it("keeps pinned chats above status groups and removes them from those groups", () => {
    const projection = buildSidebarProjection(projectionInput({ groupMode: "status" }));

    expect(projection.workspaceGroups.map((group) => group.key)).toEqual(["needs_input"]);
    expect(projection.workspaceGroups[0]?.rows.map((entry) => entry.workspaceId)).toEqual([
      "unpinned",
    ]);
    expect(projection.shortcutModel.shortcutTargets).toEqual([
      { serverId: "srv", workspaceId: "pinned" },
      { serverId: "srv", workspaceId: "unpinned" },
    ]);
  });

  it("groups by label, repeats a multi-label workspace, and puts unlabelled last", () => {
    const both = makeWorkspace("both", "running", ["Urgent", "Backend"]);
    const none = makeWorkspace("none", "done", []);
    const projection = buildSidebarProjection({
      ...projectionInput({ groupMode: "label" }),
      projects: [makeProject([both.placement, none.placement])],
      pinnedKeys: { pinnedWorkspaceKeys: [], pinnedAtByKey: {} },
      workspaceEntriesByKey: new Map([
        [both.entry.workspaceKey, both.entry],
        [none.entry.workspaceKey, none.entry],
      ]),
    });

    // Catalog order, with Unlabelled at the end.
    expect(projection.workspaceGroups.map((group) => group.key)).toEqual([
      "label:backend",
      "label:urgent",
      "label:",
    ]);
    expect(projection.workspaceGroups[0]?.rows.map((entry) => entry.workspaceId)).toEqual(["both"]);
    expect(projection.workspaceGroups[1]?.rows.map((entry) => entry.workspaceId)).toEqual(["both"]);
    expect(projection.workspaceGroups[2]?.rows.map((entry) => entry.workspaceId)).toEqual(["none"]);
    expect(projection.workspaceGroups[0]?.leading).toEqual({ kind: "label", color: "blue" });
    expect(projection.workspaceGroups[2]?.leading).toEqual({ kind: "label", color: null });
  });

  it("orders rows inside a label group by the Sort setting across projects", () => {
    const older = makeWorkspace("a-older", "done", ["Urgent"], "project");
    const newer = makeWorkspace("b-newer", "done", ["Urgent"], "other-project");
    const prompted = makeWorkspace("c-prompted", "done", ["Urgent"], "project");
    older.entry.createdAt = new Date("2026-01-01T00:00:00Z");
    older.entry.lastUserMessageAt = new Date("2026-03-01T00:00:00Z");
    newer.entry.createdAt = new Date("2026-02-01T00:00:00Z");
    prompted.entry.createdAt = new Date("2026-01-15T00:00:00Z");
    prompted.entry.lastUserMessageAt = new Date("2026-04-01T00:00:00Z");
    const rowsUnder = (workspaceSort: WorkspaceSort | undefined) =>
      buildSidebarProjection({
        ...projectionInput({ groupMode: "label" }),
        workspaceSort,
        projects: [
          makeProject([older.placement, prompted.placement]),
          makeProject([newer.placement], "other-project"),
        ],
        pinnedKeys: { pinnedWorkspaceKeys: [], pinnedAtByKey: {} },
        workspaceEntriesByKey: new Map(
          [older, newer, prompted].map((workspace) => [
            workspace.entry.workspaceKey,
            workspace.entry,
          ]),
        ),
      })
        .workspaceGroups.find((group) => group.key === "label:urgent")
        ?.rows.map((entry) => entry.workspaceId);

    expect(rowsUnder("created")).toEqual(["b-newer", "c-prompted", "a-older"]);
    expect(rowsUnder("lastPrompt")).toEqual(["c-prompted", "a-older", "b-newer"]);
    // A host without sort times falls back to name order, as project groups do.
    expect(rowsUnder(undefined)).toEqual(["a-older", "b-newer", "c-prompted"]);
  });

  it("renders a group for every catalog label even when nothing carries it", () => {
    // Only Urgent is carried; Backend has no workspace but is in the catalog.
    const urgent = makeWorkspace("urgent-only", "running", ["Urgent"]);
    const projection = buildSidebarProjection({
      ...projectionInput({ groupMode: "label" }),
      projects: [makeProject([urgent.placement])],
      pinnedKeys: { pinnedWorkspaceKeys: [], pinnedAtByKey: {} },
      workspaceEntriesByKey: new Map([[urgent.entry.workspaceKey, urgent.entry]]),
    });

    // Backend appears with no rows; no Unlabelled group because nothing is unlabelled.
    expect(projection.workspaceGroups.map((group) => group.key)).toEqual([
      "label:backend",
      "label:urgent",
    ]);
    expect(projection.workspaceGroups[0]?.rows).toEqual([]);
    expect(projection.workspaceGroups[1]?.rows.map((entry) => entry.workspaceId)).toEqual([
      "urgent-only",
    ]);
  });

  it("gives a workspace under two labels one shortcut number", () => {
    const both = makeWorkspace("both", "running", ["Urgent", "Backend"]);
    const other = makeWorkspace("other", "done", ["Urgent"]);
    const projection = buildSidebarProjection({
      ...projectionInput({ groupMode: "label" }),
      projects: [makeProject([both.placement, other.placement])],
      pinnedKeys: { pinnedWorkspaceKeys: [], pinnedAtByKey: {} },
      workspaceEntriesByKey: new Map([
        [both.entry.workspaceKey, both.entry],
        [other.entry.workspaceKey, other.entry],
      ]),
    });

    expect(projection.shortcutModel.shortcutTargets.map((target) => target.workspaceId)).toEqual([
      "both",
      "other",
    ]);
    expect([...projection.shortcutModel.shortcutIndexByWorkspaceKey]).toEqual([
      ["srv:both", 1],
      ["srv:other", 2],
    ]);
  });

  it("does not number pinned chats while the pinned section is collapsed", () => {
    const projection = buildSidebarProjection(
      projectionInput({ groupMode: "status", pinnedCollapsed: true }),
    );

    expect(projection.shortcutModel.shortcutTargets).toEqual([
      { serverId: "srv", workspaceId: "unpinned" },
    ]);
  });
});
