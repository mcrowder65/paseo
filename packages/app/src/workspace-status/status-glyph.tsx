import type { ReactElement } from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { withUnistyles } from "react-native-unistyles";
import { identityForeground } from "@/styles/identity-colors";
import type { Theme } from "@/styles/theme";
import type { WorkspaceManualStatus } from "@getpaseo/protocol/workspace-status";

// Linear/Conductor status marks: a dashed ring for Backlog, pie-filled rings for the working
// states, filled discs with a knockout glyph for the terminal ones. lucide has no graduated pie,
// so these are drawn by hand in a 16-unit box scaled to the requested size.
const VIEW_BOX = 16;
const CENTER = VIEW_BOX / 2;
const RADIUS = 5.3;
const RING_STROKE = 1.4;
const PIE_RADIUS = RADIUS - 1.1;
const KNOCKOUT_STROKE = 1.6;

const CHECK_PATH = "M4.9 8.3 L7 10.4 L11.2 5.8";
const CROSS_PATH = "M6 6 L10 10 M10 6 L6 10";

type StatusColors = Record<WorkspaceManualStatus, string>;

interface StatusGlyphPalette {
  colors: StatusColors;
  // The cut-out colour for the check/cross on a filled disc — the surface behind the glyph, so
  // the mark reads as knocked out of the disc rather than painted on top.
  knockout: string;
}

const glyphPaletteMapping = (theme: Theme): { palette: StatusGlyphPalette } => ({
  palette: {
    colors: {
      backlog: theme.colors.foregroundMuted,
      in_progress: theme.colors.statusDotWarning,
      in_review: theme.colors.statusDotSuccess,
      done: identityForeground("pink", theme.colorScheme),
      canceled: theme.colors.foregroundMuted,
    },
    knockout: theme.colors.surfaceSidebar,
  },
});

// A wedge from twelve o'clock, clockwise, covering `fraction` of the circle.
function piePath(fraction: number): string {
  const angle = fraction * 2 * Math.PI;
  const endX = CENTER + PIE_RADIUS * Math.sin(angle);
  const endY = CENTER - PIE_RADIUS * Math.cos(angle);
  const largeArc = fraction > 0.5 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - PIE_RADIUS} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function StatusGlyphSvg({
  status,
  size,
  palette,
}: {
  status: WorkspaceManualStatus;
  size: number;
  palette: StatusGlyphPalette;
}): ReactElement {
  const color = palette.colors[status];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {status === "backlog" ? (
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeDasharray="1.5 1.8"
          strokeLinecap="round"
        />
      ) : null}
      {status === "in_progress" || status === "in_review" ? (
        <>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={RING_STROKE}
          />
          <Path d={piePath(status === "in_review" ? 0.62 : 0.5)} fill={color} />
        </>
      ) : null}
      {status === "done" || status === "canceled" ? (
        <>
          <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill={color} />
          <Path
            d={status === "done" ? CHECK_PATH : CROSS_PATH}
            fill="none"
            stroke={palette.knockout}
            strokeWidth={KNOCKOUT_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
    </Svg>
  );
}

const ThemedStatusGlyphSvg = withUnistyles(StatusGlyphSvg);

export function WorkspaceStatusGlyph({
  status,
  size = 14,
}: {
  status: WorkspaceManualStatus;
  size?: number;
}): ReactElement {
  return <ThemedStatusGlyphSvg status={status} size={size} uniProps={glyphPaletteMapping} />;
}
