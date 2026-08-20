import {
  WORKSPACE_MANUAL_STATUS_META,
  WORKSPACE_MANUAL_STATUS_ORDER,
  type WorkspaceManualStatus,
} from "@getpaseo/protocol/workspace-status";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";

export interface BoardGroup {
  status: WorkspaceManualStatus;
  label: string;
  rows: SidebarWorkspaceEntry[];
}

// The board is manual only — activity never moves a card. A workspace you have not filed sits in
// this fixed default column until you do; its live activity still shows as the row's status dot.
const DEFAULT_BOARD_STATUS: WorkspaceManualStatus = "in_progress";

export function effectiveWorkspaceManualStatus(
  workspace: SidebarWorkspaceEntry,
): WorkspaceManualStatus {
  return workspace.manualStatus ?? DEFAULT_BOARD_STATUS;
}

/**
 * Groups workspaces into the fixed manual-status columns. Every column is present even when empty,
 * the way Conductor lays its board out — an empty Backlog or Canceled is information, not clutter.
 */
export function buildBoardGroups(
  workspaces: SidebarWorkspaceEntry[],
  projectNamesByViewKey: Map<string, string>,
): BoardGroup[] {
  const rowsByStatus = new Map<WorkspaceManualStatus, SidebarWorkspaceEntry[]>();
  for (const status of WORKSPACE_MANUAL_STATUS_ORDER) {
    rowsByStatus.set(status, []);
  }
  for (const workspace of workspaces) {
    rowsByStatus.get(effectiveWorkspaceManualStatus(workspace))?.push(workspace);
  }

  return WORKSPACE_MANUAL_STATUS_ORDER.map((status) => {
    const rows = rowsByStatus.get(status) ?? [];
    rows.sort((a, b) => compareBoardRows(a, b, projectNamesByViewKey));
    return { status, label: WORKSPACE_MANUAL_STATUS_META[status].label, rows };
  });
}

function compareBoardRows(
  a: SidebarWorkspaceEntry,
  b: SidebarWorkspaceEntry,
  projectNamesByViewKey: Map<string, string>,
): number {
  const aTime = a.statusEnteredAt?.getTime() ?? null;
  const bTime = b.statusEnteredAt?.getTime() ?? null;
  if (aTime !== null && bTime !== null) {
    if (aTime !== bTime) return bTime - aTime;
  } else if (aTime !== null) {
    return -1;
  } else if (bTime !== null) {
    return 1;
  }

  const aProject = projectNamesByViewKey.get(a.projectViewKey) ?? "";
  const bProject = projectNamesByViewKey.get(b.projectViewKey) ?? "";
  const projectCmp = aProject.localeCompare(bProject);
  if (projectCmp !== 0) return projectCmp;

  const nameCmp = a.name.localeCompare(b.name);
  if (nameCmp !== 0) return nameCmp;

  return a.workspaceKey.localeCompare(b.workspaceKey);
}
