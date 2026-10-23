import {
  workspaceLabelKey,
  type WorkspaceLabelColor,
  type WorkspaceLabelDefinition,
} from "@getpaseo/protocol/workspace-labels";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";
import { SIDEBAR_UNLABELLED_LABEL_KEY, type SidebarLabelFilter } from "@/stores/sidebar-view-store";
import type { StatusBucket, StatusGroup } from "@/hooks/sidebar-status-view-model";
import { compareWorkspacesBySort, type WorkspaceSort } from "@/projects/workspace-structure";

export type SidebarWorkspaceGroupLeading =
  | { kind: "status"; bucket: StatusBucket }
  | { kind: "label"; color: WorkspaceLabelColor | null };

export interface SidebarWorkspaceGroup {
  key: string;
  label: string;
  rows: SidebarWorkspaceEntry[];
  leading: SidebarWorkspaceGroupLeading;
}

// Label and status group keys share one persisted collapsed-set; the prefix keeps a label named
// "done" from collapsing with the Done bucket.
const LABEL_GROUP_KEY_PREFIX = "label:";

export const LABEL_UNLABELLED_GROUP_KEY = `${LABEL_GROUP_KEY_PREFIX}${SIDEBAR_UNLABELLED_LABEL_KEY}`;

function labelGroupKey(labelKey: string): string {
  return `${LABEL_GROUP_KEY_PREFIX}${labelKey}`;
}

export function labelKeyOfGroupKey(groupKey: string): string {
  return groupKey.slice(LABEL_GROUP_KEY_PREFIX.length);
}

export function statusWorkspaceGroups(groups: readonly StatusGroup[]): SidebarWorkspaceGroup[] {
  return groups.map((group) => ({
    key: group.bucket,
    label: group.label,
    rows: group.rows,
    leading: { kind: "status", bucket: group.bucket },
  }));
}

/** One group per label in `labelDefinitions` order, then carried labels it lacks, then Unlabelled. */
export function labelWorkspaceGroups(input: {
  workspaces: readonly SidebarWorkspaceEntry[];
  labelDefinitions: readonly WorkspaceLabelDefinition[];
  unlabelledLabel: string;
  workspaceSort: WorkspaceSort | undefined;
  labelFilter: SidebarLabelFilter;
}): SidebarWorkspaceGroup[] {
  const colorByKey = new Map<string, WorkspaceLabelColor>();
  const nameByKey = new Map<string, string>();
  const rowsByKey = new Map<string, SidebarWorkspaceEntry[]>();
  for (const definition of input.labelDefinitions) {
    const key = workspaceLabelKey(definition.name);
    if (!key || rowsByKey.has(key)) continue;
    colorByKey.set(key, definition.color);
    nameByKey.set(key, definition.name);
    rowsByKey.set(key, []);
  }

  const uncataloguedKeys: string[] = [];
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
        uncataloguedKeys.push(key);
      }
      rows.push(workspace);
    }
  }
  uncataloguedKeys.sort((a, b) => compareLabelNames(nameByKey.get(a) ?? a, nameByKey.get(b) ?? b));
  const uncatalogued = new Set(uncataloguedKeys);
  const filterKeys = new Set(input.labelFilter.labels);
  const orderedKeys = [
    ...[...rowsByKey.keys()].filter((key) => !uncatalogued.has(key)),
    ...uncataloguedKeys,
  ].filter((key) => filterKeys.size === 0 || filterKeys.has(key));

  const compareRows = (a: SidebarWorkspaceEntry, b: SidebarWorkspaceEntry) =>
    compareWorkspacesBySort(a, b, input.workspaceSort);
  const groups: SidebarWorkspaceGroup[] = orderedKeys.map((key) => ({
    key: labelGroupKey(key),
    label: nameByKey.get(key) ?? key,
    rows: (rowsByKey.get(key) ?? []).sort(compareRows),
    leading: { kind: "label", color: colorByKey.get(key) ?? null },
  }));

  if (unlabelledRows.length > 0) {
    groups.push({
      key: LABEL_UNLABELLED_GROUP_KEY,
      label: input.unlabelledLabel,
      rows: unlabelledRows.sort(compareRows),
      leading: { kind: "label", color: null },
    });
  }

  return groups;
}

export function selectGroupLabelDefinitions(input: {
  labels: readonly WorkspaceLabelDefinition[];
  hosts: readonly { serverId: string; labels: readonly WorkspaceLabelDefinition[] }[];
  serverIds: readonly string[];
}): WorkspaceLabelDefinition[] {
  const visibleServerIds = new Set(input.serverIds);
  const visibleKeys = new Set(
    input.hosts
      .filter((host) => visibleServerIds.has(host.serverId))
      .flatMap((host) => host.labels.map((label) => workspaceLabelKey(label.name))),
  );
  return input.labels.filter((label) => visibleKeys.has(workspaceLabelKey(label.name)));
}

function compareLabelNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
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
