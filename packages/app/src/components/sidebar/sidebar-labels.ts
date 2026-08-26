import {
  workspaceLabelKey,
  type WorkspaceLabelColor,
  type WorkspaceLabelDefinition,
} from "@getpaseo/protocol/workspace-labels";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";
import { SIDEBAR_UNLABELLED_LABEL_KEY, type SidebarLabelFilter } from "@/stores/sidebar-view-store";
import type { StatusBucket, StatusGroup } from "@/hooks/sidebar-status-view-model";

export type SidebarWorkspaceGroupLeading =
  | { kind: "status"; bucket: StatusBucket }
  // `null` is the Unlabelled group, the one header with no color to stand for.
  | { kind: "label"; color: WorkspaceLabelColor | null };

export interface SidebarWorkspaceGroup {
  key: string;
  label: string;
  rows: SidebarWorkspaceEntry[];
  leading: SidebarWorkspaceGroupLeading;
}

// Group keys are shared with status buckets in one persisted collapsed-set, so label keys carry a
// prefix a bucket name can never wear — otherwise a label named "done" and the Done bucket would
// collapse as one.
const LABEL_GROUP_KEY_PREFIX = "label:";

/** The one label group that stands for "carries no label" — it takes no manual actions a label does. */
export const LABEL_UNLABELLED_GROUP_KEY = `${LABEL_GROUP_KEY_PREFIX}${SIDEBAR_UNLABELLED_LABEL_KEY}`;

export function statusWorkspaceGroups(groups: readonly StatusGroup[]): SidebarWorkspaceGroup[] {
  return groups.map((group) => ({
    key: group.bucket,
    label: group.label,
    rows: group.rows,
    leading: { kind: "status", bucket: group.bucket },
  }));
}

/**
 * Groups the sidebar by the labels its workspaces carry.
 *
 * A workspace with several labels appears under each of them — a label group is "everything
 * carrying this label", not a partition. Workspaces with no label fall into one Unlabelled group
 * at the end.
 *
 * Every label in the catalog gets a group even when nothing carries it, so an empty label is still
 * a place to drop work into. Unlabelled is not a catalog label, so it only appears when a workspace
 * actually has no label.
 *
 * Colors come from the merged catalog rather than the rows: `SidebarWorkspaceEntry.labels` is only
 * names. A label a workspace carries that the catalog has not caught up to still gets a group, with
 * a hollow header dot (`color: null`) until the catalog names its color.
 */
export function labelWorkspaceGroups(input: {
  workspaces: readonly SidebarWorkspaceEntry[];
  labelDefinitions: readonly WorkspaceLabelDefinition[];
  unlabelledLabel: string;
}): SidebarWorkspaceGroup[] {
  const colorByKey = new Map<string, WorkspaceLabelColor>();
  const nameByKey = new Map<string, string>();
  // Seed a group per catalog label up front so labels with no workspaces still render.
  const rowsByKey = new Map<string, SidebarWorkspaceEntry[]>();
  for (const definition of input.labelDefinitions) {
    const key = workspaceLabelKey(definition.name);
    if (!key || colorByKey.has(key)) continue;
    colorByKey.set(key, definition.color);
    nameByKey.set(key, definition.name);
    rowsByKey.set(key, []);
  }

  const unlabelledRows: SidebarWorkspaceEntry[] = [];
  for (const workspace of input.workspaces) {
    const keys = new Set<string>();
    for (const rawName of workspace.labels ?? []) {
      const key = workspaceLabelKey(rawName);
      if (!key) continue;
      keys.add(key);
      if (!nameByKey.has(key)) nameByKey.set(key, rawName);
    }
    if (keys.size === 0) {
      unlabelledRows.push(workspace);
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

  const groups: SidebarWorkspaceGroup[] = [...rowsByKey.keys()]
    .sort((a, b) => (nameByKey.get(a) ?? a).localeCompare(nameByKey.get(b) ?? b))
    .map((key) => {
      const rows = rowsByKey.get(key) ?? [];
      rows.sort(compareLabelRows);
      return {
        key: `${LABEL_GROUP_KEY_PREFIX}${key}`,
        label: nameByKey.get(key) ?? key,
        rows,
        leading: { kind: "label", color: colorByKey.get(key) ?? null },
      };
    });

  if (unlabelledRows.length > 0) {
    unlabelledRows.sort(compareLabelRows);
    groups.push({
      key: `${LABEL_GROUP_KEY_PREFIX}${SIDEBAR_UNLABELLED_LABEL_KEY}`,
      label: input.unlabelledLabel,
      rows: unlabelledRows,
      leading: { kind: "label", color: null },
    });
  }

  return groups;
}

function compareLabelRows(a: SidebarWorkspaceEntry, b: SidebarWorkspaceEntry): number {
  const nameCmp = a.name.localeCompare(b.name);
  if (nameCmp !== 0) return nameCmp;
  return a.workspaceKey.localeCompare(b.workspaceKey);
}

/**
 * Applies the Labels page's selection to the sidebar.
 *
 * `Unlabelled` is a row like any other, so it is a key in the same list rather than a boolean
 * beside it; the only thing that makes it special is what the key asks of a workspace.
 * Selecting several labels includes workspaces carrying any of them.
 */
export function filterWorkspacesByLabels(
  input: { workspaces: readonly SidebarWorkspaceEntry[] } & SidebarLabelFilter,
): SidebarWorkspaceEntry[] {
  const { workspaces, labels } = input;
  if (labels.length === 0) return [...workspaces];
  return workspaces.filter((workspace) => {
    // Whitespace-only names normalize away, so `size === 0` is exactly "carries no real label"
    // and the empty key can only ever mean Unlabelled.
    const keys = new Set((workspace.labels ?? []).map(workspaceLabelKey).filter(Boolean));
    const matches = (key: string) =>
      key === SIDEBAR_UNLABELLED_LABEL_KEY ? keys.size === 0 : keys.has(key);
    return labels.some(matches);
  });
}
