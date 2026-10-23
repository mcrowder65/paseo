import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { gotoAppShell } from "../support/helpers/app";
import { getServerId } from "../support/helpers/server-id";
import { seedWorkspace } from "../support/helpers/seed-client";
import { selectSidebarLabelGrouping } from "../support/helpers/sidebar";
import { waitForSidebarHydration } from "../support/helpers/workspace-ui";

type Seeded = Awaited<ReturnType<typeof seedWorkspace>>;

interface Seeds {
  both: Seeded;
  backend: Seeded;
  plain: Seeded;
}

// A worker's daemon outlives a spec file, so other specs' labels can share the catalog.
const SEEDED_LABELS = ["Backend", "Empty", "Urgent"];

async function testIds(locator: Locator, keep: readonly string[]): Promise<string[]> {
  const ids = await locator.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-testid") ?? ""),
  );
  return ids.filter((id) => keep.includes(id));
}

function groupHeaderIds(page: Page) {
  return testIds(page.locator('[data-testid^="sidebar-status-group-label:"]'), [
    ...SEEDED_LABELS.map((name) => `sidebar-status-group-label:${name.toLowerCase()}`),
    "sidebar-status-group-label:",
  ]);
}

function managerLabelIds(page: Page) {
  return testIds(
    page.locator('[data-testid^="workspace-label-manager-label-"]'),
    SEEDED_LABELS.map((name) => `workspace-label-manager-label-${name}`),
  );
}

function workspaceRow(scope: Page | Locator, workspaceId: string) {
  return scope.getByTestId(`sidebar-workspace-row-${getServerId()}:${workspaceId}`);
}

function groupRows(page: Page, labelKey: string) {
  return page.getByTestId(`sidebar-status-group-rows-label:${labelKey}`);
}

async function setLabel(seeded: Seeded, name: string, assigned: boolean) {
  await seeded.client.setWorkspaceLabel({
    workspaceId: seeded.workspaceId,
    label: { name, color: "sky" },
    assigned,
  });
}

async function seedLabelledWorkspaces(): Promise<Seeds> {
  const both = await seedWorkspace({ repoPrefix: "label-grouping-both-" });
  const backend = await seedWorkspace({ repoPrefix: "label-grouping-backend-" });
  const plain = await seedWorkspace({ repoPrefix: "label-grouping-plain-" });
  await setLabel(both, "Urgent", true);
  await setLabel(both, "Backend", true);
  await setLabel(backend, "Backend", true);
  // Assigned and removed: a catalog label nothing carries.
  await setLabel(backend, "Empty", true);
  await setLabel(backend, "Empty", false);
  return { both, backend, plain };
}

async function expectWorkspacesUnderEveryLabel(page: Page, seeds: Seeds) {
  await expect
    .poll(() => groupHeaderIds(page))
    .toEqual([
      "sidebar-status-group-label:backend",
      "sidebar-status-group-label:empty",
      "sidebar-status-group-label:urgent",
      "sidebar-status-group-label:",
    ]);
  await expect(workspaceRow(groupRows(page, "backend"), seeds.both.workspaceId)).toBeVisible();
  await expect(workspaceRow(groupRows(page, "backend"), seeds.backend.workspaceId)).toBeVisible();
  await expect(workspaceRow(groupRows(page, "urgent"), seeds.both.workspaceId)).toBeVisible();
  await expect(workspaceRow(groupRows(page, ""), seeds.plain.workspaceId)).toBeVisible();
}

async function expectEmptyGroupStaysCollapsed(page: Page) {
  await expect(groupRows(page, "empty")).toHaveCount(0);
  await page.getByTestId("sidebar-status-group-label:empty").click();
  await expect(groupRows(page, "empty")).toHaveCount(0);
  await expect(groupRows(page, "urgent")).toBeVisible();
}

async function dragHeaderAbove(page: Page, sourceTestId: string, targetTestId: string) {
  const source = await page.getByTestId(sourceTestId).boundingBox();
  const target = await page.getByTestId(targetTestId).boundingBox();
  if (!source || !target) throw new Error("Expected visible label group headers");
  const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y - 7);
  await page.mouse.move(target.x + target.width / 2, target.y + 2, { steps: 6 });
  await page.mouse.up();
}

const DRAGGED_ORDER = [
  "sidebar-status-group-label:empty",
  "sidebar-status-group-label:backend",
  "sidebar-status-group-label:urgent",
  "sidebar-status-group-label:",
];

async function expectHeaderDragPersists(page: Page) {
  await dragHeaderAbove(
    page,
    "sidebar-status-group-label:empty",
    "sidebar-status-group-label:backend",
  );
  await expect.poll(() => groupHeaderIds(page)).toEqual(DRAGGED_ORDER);
  await page.reload();
  await expect(page.getByTestId("sidebar-status-group-label:empty")).toBeVisible({
    timeout: 60_000,
  });
  await expect.poll(() => groupHeaderIds(page)).toEqual(DRAGGED_ORDER);
}

// The catalog was seeded Urgent, Backend, Empty, so a list that ignores the order shows that.
async function expectManageLabelsOrder(page: Page, names: string[]) {
  await page.getByTestId("sidebar-display-preferences-menu").click();
  await page.getByTestId("sidebar-display-label-filter").click();
  await page.getByTestId("sidebar-label-manage").click();
  await expect(page.getByText("Manage labels", { exact: true })).toBeVisible();
  await expect
    .poll(() => managerLabelIds(page))
    .toEqual(names.map((name) => `workspace-label-manager-label-${name}`));
  await page.keyboard.press("Escape");
  await expect(page.getByText("Manage labels", { exact: true })).toBeHidden();
}

test.describe.configure({ timeout: 180_000 });

test("groups the sidebar by label and shares the group order with Manage labels", async ({
  page,
}) => {
  const seeds = await seedLabelledWorkspaces();
  try {
    await gotoAppShell(page);
    await waitForSidebarHydration(page);
    await selectSidebarLabelGrouping(page);
    await page.keyboard.press("Escape");

    await expectWorkspacesUnderEveryLabel(page, seeds);
    await expectEmptyGroupStaysCollapsed(page);
    await expectManageLabelsOrder(page, ["Backend", "Empty", "Urgent"]);
    await expectHeaderDragPersists(page);
    await expectManageLabelsOrder(page, ["Empty", "Backend", "Urgent"]);
  } finally {
    for (const name of SEEDED_LABELS) {
      await seeds.both.client.deleteWorkspaceLabel({ name });
    }
    await seeds.both.cleanup();
    await seeds.backend.cleanup();
    await seeds.plain.cleanup();
  }
});
