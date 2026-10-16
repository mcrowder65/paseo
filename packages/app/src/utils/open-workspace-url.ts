import { getIsElectron } from "@/constants/platform";
import {
  createWorkspaceBrowser,
  getBrowserRecord,
  normalizeWorkspaceBrowserUrl,
} from "@/desktop/browser/store";
import { navigateToWorkspace } from "@/stores/navigation-active-workspace-store";
import { collectAllTabs, useWorkspaceLayoutStore } from "@/stores/workspace-layout-store";
import { buildWorkspaceTabPersistenceKey } from "@/workspace-tabs/model";
import { isHttpUrl } from "./http-url";
import { openExternalUrl } from "./open-external-url";

export interface OpenWorkspaceUrlInput {
  serverId: string;
  workspaceId: string;
  url: string;
}

function findBrowserShowingUrl(workspaceKey: string, url: string): string | null {
  const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey];
  if (!layout) return null;
  for (const tab of collectAllTabs(layout.root)) {
    if (tab.target.kind !== "browser") continue;
    if (getBrowserRecord(tab.target.browserId)?.url === url) return tab.target.browserId;
  }
  return null;
}

/** Opens `url` in a Paseo browser tab of the given workspace on desktop, externally elsewhere. */
export async function openWorkspaceUrl(input: OpenWorkspaceUrlInput): Promise<void> {
  const workspaceKey = buildWorkspaceTabPersistenceKey({
    serverId: input.serverId,
    workspaceId: input.workspaceId,
  });
  if (!getIsElectron() || !workspaceKey || !isHttpUrl(input.url)) {
    await openExternalUrl(input.url);
    return;
  }
  const url = normalizeWorkspaceBrowserUrl(input.url);
  const browserId =
    findBrowserShowingUrl(workspaceKey, url) ??
    createWorkspaceBrowser({ initialUrl: url }).browserId;
  useWorkspaceLayoutStore.getState().openTab({
    workspaceKey,
    target: { kind: "browser", browserId },
    intent: "reveal",
  });
  navigateToWorkspace({ serverId: input.serverId, workspaceId: input.workspaceId });
}
