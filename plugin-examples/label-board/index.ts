import type { PluginContext } from "@getpaseo/plugin";
import { LabelBoard } from "./main.client";

export default function contribute(plugin: PluginContext) {
  plugin.addSurface("board", LabelBoard);
  plugin.addSidebarItem({
    id: "board",
    title: "Label board",
    icon: "LayoutGrid",
    surface: "board",
  });
  plugin.addCommandCenterItem({
    id: "open-label-board",
    title: "Open label board",
    icon: "LayoutGrid",
    context: "global",
    keywords: ["board", "labels", "columns", "kanban"],
    onSelect({ openSurface }) {
      openSurface("board");
    },
  });
  return () => {};
}
