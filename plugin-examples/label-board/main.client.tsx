import { type PluginSurfaceProps, type PluginTheme, usePaseo } from "@getpaseo/plugin";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

type Paseo = ReturnType<typeof usePaseo>;
type LabelDef = Awaited<ReturnType<Paseo["workspaces"]["labels"]["list"]>>[number];
type Workspace = Awaited<ReturnType<Paseo["workspaces"]["list"]>>["entries"][number];
type BoardStyles = ReturnType<typeof createStyles>;

// The plugin theme carries only a handful of tokens, so the label palette lives
// here. Keys mirror WorkspaceLabelColor; anything missing falls back to accent.
const LABEL_HEX: Record<string, string> = {
  violet: "#8b5cf6",
  sky: "#0ea5e9",
  emerald: "#10b981",
  orange: "#f97316",
  pink: "#ec4899",
  indigo: "#6366f1",
  teal: "#14b8a6",
  red: "#ef4444",
  amber: "#f59e0b",
  blue: "#3b82f6",
};

interface Column {
  key: string;
  label: LabelDef | null;
  workspaces: Workspace[];
}

function labelKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

function Dot(props: { color: string; base: BoardStyles["dot"] }) {
  const style = useMemo(
    () => [props.base, { backgroundColor: props.color }],
    [props.base, props.color],
  );
  return <View style={style} />;
}

function MoveChip(props: {
  workspace: Workspace;
  target: Column;
  busy: boolean;
  styles: BoardStyles;
  onMove: (workspace: Workspace, target: LabelDef | null) => void;
}) {
  const { workspace, target, busy, styles, onMove } = props;
  const name = target.label?.name ?? "Unlabelled";
  const handlePress = useCallback(() => {
    onMove(workspace, target.label);
  }, [onMove, workspace, target.label]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Move ${workspace.name} to ${name}`}
      disabled={busy}
      onPress={handlePress}
      style={styles.moveChip}
    >
      <Text style={styles.moveChipText}>{busy ? "…" : `→ ${name}`}</Text>
    </Pressable>
  );
}

function WorkspaceCard(props: {
  workspace: Workspace;
  columns: Column[];
  columnKey: string;
  busy: boolean;
  styles: BoardStyles;
  onMove: (workspace: Workspace, target: LabelDef | null) => void;
}) {
  const { workspace, columns, columnKey, busy, styles, onMove } = props;
  const targets = useMemo(
    () => columns.filter((column) => column.key !== columnKey),
    [columns, columnKey],
  );
  return (
    <View style={styles.card}>
      <Text style={styles.cardName}>{workspace.name}</Text>
      <Text style={styles.cardProject}>{workspace.projectDisplayName}</Text>
      <View style={styles.moveRow}>
        {targets.map((target) => (
          <MoveChip
            key={target.key}
            workspace={workspace}
            target={target}
            busy={busy}
            styles={styles}
            onMove={onMove}
          />
        ))}
      </View>
    </View>
  );
}

export function LabelBoard({ theme, layout }: PluginSurfaceProps) {
  const paseo = usePaseo();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [labels, setLabels] = useState<LabelDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [list, catalog] = await Promise.all([
        paseo.workspaces.list({ page: { limit: 200 } }),
        paseo.workspaces.labels.list(),
      ]);
      setWorkspaces(list.entries);
      setLabels(catalog);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [paseo]);

  useEffect(() => {
    void reload();
    // A workspace_update fires whenever an assignment lands, so the board
    // re-groups itself after every move — including moves from the main app.
    const unsubscribe = paseo.workspaces.subscribe(() => {
      void reload();
    });
    return unsubscribe;
  }, [paseo, reload]);

  const move = useCallback(
    async (workspace: Workspace, target: LabelDef | null) => {
      setBusyId(workspace.id);
      try {
        // Labels are multi-valued; a single-column board treats "move" as
        // "carry exactly the target label", so strip everything first.
        for (const name of workspace.labels ?? []) {
          if (!name.trim()) continue;
          const def = labels.find((entry) => labelKey(entry.name) === labelKey(name));
          await paseo.workspaces.labels.assign({
            workspaceId: workspace.id,
            label: def ?? { name, color: "violet" },
            assigned: false,
          });
        }
        if (target) {
          await paseo.workspaces.labels.assign({
            workspaceId: workspace.id,
            label: target,
            assigned: true,
          });
        }
        await reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setBusyId(null);
      }
    },
    [paseo, labels, reload],
  );

  const columns = useMemo<Column[]>(() => {
    const labelColumns: Column[] = labels.map((label) => ({
      key: labelKey(label.name),
      label,
      workspaces: [],
    }));
    const unlabelled: Column = { key: " unlabelled", label: null, workspaces: [] };
    for (const workspace of workspaces) {
      const names = (workspace.labels ?? []).filter((name) => name.trim());
      if (names.length === 0) {
        unlabelled.workspaces.push(workspace);
        continue;
      }
      let placed = false;
      for (const column of labelColumns) {
        if (names.some((name) => labelKey(name) === column.key)) {
          column.workspaces.push(workspace);
          placed = true;
        }
      }
      // A label the catalog has forgotten still deserves a home.
      if (!placed) unlabelled.workspaces.push(workspace);
    }
    return [...labelColumns, unlabelled];
  }, [labels, workspaces]);

  const styles = useMemo(() => createStyles(theme, layout.compact), [theme, layout.compact]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Label board</Text>
        <Text style={styles.subtitle}>
          Group workspaces by label. Tap a chip on a card to move it to another column.
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView horizontal contentContainerStyle={styles.board}>
        {columns.map((column) => {
          const color = column.label
            ? (LABEL_HEX[column.label.color] ?? theme.colors.accent)
            : theme.colors.foregroundMuted;
          return (
            <View key={column.key} style={styles.column}>
              <View style={styles.columnHeader}>
                <Dot color={color} base={styles.dot} />
                <Text style={styles.columnTitle}>{column.label?.name ?? "Unlabelled"}</Text>
                <Text style={styles.count}>{column.workspaces.length}</Text>
              </View>
              {column.workspaces.length === 0 ? (
                <Text style={styles.empty}>No workspaces</Text>
              ) : (
                column.workspaces.map((workspace) => (
                  <WorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    columns={columns}
                    columnKey={column.key}
                    busy={busyId === workspace.id}
                    styles={styles}
                    onMove={move}
                  />
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: PluginTheme, compact: boolean) {
  return {
    screen: { flex: 1, backgroundColor: theme.colors.surface0 },
    header: { padding: compact ? 12 : 20, gap: 4 },
    title: { color: theme.colors.foreground, fontSize: compact ? 18 : 22 },
    subtitle: { color: theme.colors.foregroundMuted, fontSize: 13 },
    error: { color: theme.colors.statusDanger, paddingHorizontal: 20, paddingBottom: 8 },
    board: { paddingHorizontal: 12, paddingBottom: 24, gap: 12 },
    column: {
      width: 260,
      gap: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.surface0,
    },
    columnHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    columnTitle: { color: theme.colors.foreground, fontSize: 15, fontWeight: "600" as const },
    count: { color: theme.colors.foregroundMuted, fontSize: 13 },
    card: {
      padding: 12,
      borderRadius: 10,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.foregroundMuted,
    },
    cardName: { color: theme.colors.foreground, fontSize: 14 },
    cardProject: { color: theme.colors.foregroundMuted, fontSize: 12 },
    moveRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
    moveChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.accent,
    },
    moveChipText: { color: theme.colors.accentForeground, fontSize: 12 },
    empty: { color: theme.colors.foregroundMuted, fontSize: 13, fontStyle: "italic" as const },
  };
}
