import { useCallback, useMemo, type ReactElement } from "react";
import { withUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Circle } from "lucide-react-native";
import {
  WORKSPACE_MANUAL_STATUS_META,
  WORKSPACE_MANUAL_STATUS_ORDER,
  type WorkspaceManualStatus,
} from "@getpaseo/protocol/workspace-status";
import { MenuItem, MenuSeparator, type MenuPageDefinition } from "@/components/ui/menu";
import { WorkspaceStatusGlyph } from "@/workspace-status/status-glyph";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { useToast } from "@/contexts/toast-context";
import type { Theme } from "@/styles/theme";

/** The `MenuSubTrigger` on a workspace's menu that opens the status page. */
export const WORKSPACE_STATUS_PAGE_ID = "workspaceStatus";

const ThemedCircle = withUnistyles(Circle);
const mutedMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });

export interface WorkspaceStatusTarget {
  serverId: string;
  workspaceId: string;
  current: WorkspaceManualStatus | null;
}

const NO_PAGES: readonly MenuPageDefinition[] = [];

export function useWorkspaceStatusMenuPages(
  target: WorkspaceStatusTarget | null,
): readonly MenuPageDefinition[] {
  return useMemo(() => {
    if (!target) return NO_PAGES;
    return [
      {
        id: WORKSPACE_STATUS_PAGE_ID,
        title: "Status",
        content: (
          <WorkspaceStatusPickerPage
            serverId={target.serverId}
            workspaceId={target.workspaceId}
            current={target.current}
          />
        ),
      },
    ];
  }, [target]);
}

/**
 * The five board columns as a single-select. Picking one files the workspace and closes the menu;
 * `Clear` drops the manual status so the row falls back to its live activity bucket.
 */
function WorkspaceStatusPickerPage({
  serverId,
  workspaceId,
  current,
}: {
  serverId: string;
  workspaceId: string;
  current: WorkspaceManualStatus | null;
}): ReactElement {
  const { t } = useTranslation();
  const toast = useToast();

  const setStatus = useCallback(
    (status: WorkspaceManualStatus | null) => {
      const client = getHostRuntimeStore().getClient(serverId);
      if (!client) {
        toast.error(t("workspace.terminal.hostDisconnected"));
        return;
      }
      void client.setWorkspaceStatus(workspaceId, status).catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t("workspace.terminal.hostDisconnected"),
        );
      });
    },
    [serverId, t, toast, workspaceId],
  );
  const clearStatus = useCallback(() => setStatus(null), [setStatus]);

  return (
    <>
      {WORKSPACE_MANUAL_STATUS_ORDER.map((status) => (
        <WorkspaceStatusRow
          key={status}
          status={status}
          selected={current === status}
          onSelect={setStatus}
        />
      ))}
      {current !== null ? (
        <>
          <MenuSeparator />
          <WorkspaceStatusClearRow onClear={clearStatus} />
        </>
      ) : null}
    </>
  );
}

function WorkspaceStatusClearRow({ onClear }: { onClear: () => void }): ReactElement {
  const leading = useMemo(() => <ThemedCircle size={10} uniProps={mutedMapping} />, []);
  return (
    <MenuItem
      leading={leading}
      closeOnSelect
      onSelect={onClear}
      testID="workspace-status-picker-clear"
    >
      Clear status
    </MenuItem>
  );
}

function WorkspaceStatusRow({
  status,
  selected,
  onSelect,
}: {
  status: WorkspaceManualStatus;
  selected: boolean;
  onSelect: (status: WorkspaceManualStatus) => void;
}): ReactElement {
  const meta = WORKSPACE_MANUAL_STATUS_META[status];
  const leading = useMemo(() => <WorkspaceStatusGlyph status={status} />, [status]);
  const select = useCallback(() => onSelect(status), [onSelect, status]);
  return (
    <MenuItem
      leading={leading}
      selected={selected}
      closeOnSelect
      onSelect={select}
      testID={`workspace-status-picker-row-${status}`}
    >
      {meta.label}
    </MenuItem>
  );
}
