import {
  workspaceLabelKey,
  type WorkspaceLabelColor,
  type WorkspaceLabelDefinition,
} from "@getpaseo/protocol/workspace-labels";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";

export interface LabelGroup {
  key: string;
  label: string;
  // Null is the Unlabelled group, the one row with no color to stand for.
  color: WorkspaceLabelColor | null;
  rows: SidebarWorkspaceEntry[];
}

// Real label groups are keyed `label:<labelKey>`; the drag handler recovers the label key from
// this prefix. Unlabelled uses a bare key so it can never collide with a user label named, say,
// "Unlabelled" (which would normalize to the key `unlabelled`).
const LABEL_GROUP_KEY_PREFIX = "label:";
const UNLABELLED_GROUP_KEY = "unlabelled";
const UNLABELLED_GROUP_LABEL = "Unlabelled";

/** The label key a draggable label group carries, or null for the fixed Unlabelled group. */
export function labelGroupKeyToLabelKey(groupKey: string): string | null {
  return groupKey.startsWith(LABEL_GROUP_KEY_PREFIX)
    ? groupKey.slice(LABEL_GROUP_KEY_PREFIX.length)
    : null;
}

/**
 * Groups workspaces by their assigned labels. Labels are multi-valued, so a workspace carrying two
 * labels appears under both; one carrying none falls into the Unlabelled group. Empty groups are
 * dropped the way status grouping does — a defined label nothing carries is not a column, it is
 * noise.
 *
 * Column order follows the user's saved `order` (label keys) first, then any remaining labels in
 * catalog order, so a freshly created label lands at the end rather than jumping the board. The
 * Unlabelled column is always last and is not draggable.
 */
export function buildLabelGroups(
  workspaces: SidebarWorkspaceEntry[],
  labelDefinitions: readonly WorkspaceLabelDefinition[],
  order: readonly string[],
  projectNamesByViewKey: Map<string, string>,
): LabelGroup[] {
  const rowsByKey = new Map<string, SidebarWorkspaceEntry[]>();
  const unlabelled: SidebarWorkspaceEntry[] = [];

  for (const workspace of workspaces) {
    // Whitespace-only names normalize away, so an empty set is exactly "carries no real label".
    const keys = new Set((workspace.labels ?? []).map(workspaceLabelKey).filter(Boolean));
    if (keys.size === 0) {
      unlabelled.push(workspace);
      continue;
    }
    for (const key of keys) {
      let rows = rowsByKey.get(key);
      if (!rows) {
        rows = [];
        rowsByKey.set(key, rows);
      }
      rows.push(workspace);
    }
  }

  const labelGroupsByKey = new Map<string, LabelGroup>();
  for (const definition of labelDefinitions) {
    const key = workspaceLabelKey(definition.name);
    const rows = rowsByKey.get(key);
    if (!rows || rows.length === 0) continue;
    if (labelGroupsByKey.has(key)) continue;
    rows.sort((a, b) => compareLabelRows(a, b, projectNamesByViewKey));
    labelGroupsByKey.set(key, {
      key: `${LABEL_GROUP_KEY_PREFIX}${key}`,
      label: definition.name,
      color: definition.color,
      rows,
    });
  }

  const groups: LabelGroup[] = [];
  const placed = new Set<string>();
  for (const key of order) {
    const group = labelGroupsByKey.get(key);
    if (!group || placed.has(key)) continue;
    placed.add(key);
    groups.push(group);
  }
  for (const [key, group] of labelGroupsByKey) {
    if (placed.has(key)) continue;
    groups.push(group);
  }

  if (unlabelled.length > 0) {
    unlabelled.sort((a, b) => compareLabelRows(a, b, projectNamesByViewKey));
    groups.push({
      key: UNLABELLED_GROUP_KEY,
      label: UNLABELLED_GROUP_LABEL,
      color: null,
      rows: unlabelled,
    });
  }

  return groups;
}

function compareLabelRows(
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
