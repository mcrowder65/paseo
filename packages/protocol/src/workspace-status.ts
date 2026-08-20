// The user-assigned workspace status ("Conductor columns"). Distinct from the derived
// activity bucket (WorkspaceStateBucket): this is set by hand and persists, the bucket is
// recomputed from live agent/terminal activity. The sidebar's board mode overlays the two —
// a manual status wins when set, otherwise the row falls back to its derived bucket.
export const WORKSPACE_MANUAL_STATUSES = [
  "backlog",
  "in_progress",
  "in_review",
  "done",
  "canceled",
] as const;

export type WorkspaceManualStatus = (typeof WORKSPACE_MANUAL_STATUSES)[number];

// Column order in the sidebar board, top to bottom.
export const WORKSPACE_MANUAL_STATUS_ORDER: readonly WorkspaceManualStatus[] = [
  "done",
  "in_review",
  "in_progress",
  "backlog",
  "canceled",
];

export interface WorkspaceManualStatusMeta {
  label: string;
}

// Column glyphs and colours live in the client (workspace-status/status-glyph). This carries only
// the label, so a server-side rename is the one place the wording changes.
export const WORKSPACE_MANUAL_STATUS_META: Record<
  WorkspaceManualStatus,
  WorkspaceManualStatusMeta
> = {
  backlog: { label: "Backlog" },
  in_progress: { label: "In progress" },
  in_review: { label: "In review" },
  done: { label: "Done" },
  canceled: { label: "Canceled" },
};

export function isWorkspaceManualStatus(value: unknown): value is WorkspaceManualStatus {
  return (
    typeof value === "string" && (WORKSPACE_MANUAL_STATUSES as readonly string[]).includes(value)
  );
}
