import type { EditorTarget, EditorTargetRuntime } from "../target.js";

const MAC_APPLICATION = "GitHub Desktop";

function commands(runtime: EditorTargetRuntime): string[] {
  const candidates = ["github-desktop"];
  if (runtime.platform === "win32") {
    if (runtime.env.LOCALAPPDATA) {
      candidates.push(`${runtime.env.LOCALAPPDATA}/GitHubDesktop/GitHubDesktop.exe`);
    }
    if (runtime.env.ProgramFiles) {
      candidates.push(`${runtime.env.ProgramFiles}/GitHub Desktop/GitHubDesktop.exe`);
    }
  }
  return candidates;
}

export const githubDesktopTarget: EditorTarget = {
  id: "github-desktop",
  async describe(runtime) {
    return {
      id: this.id,
      label: "GitHub Desktop",
      kind: "git-client",
      icon: await runtime.loadIcon("github-desktop.png"),
    };
  },
  async isInstalled(runtime) {
    return (
      runtime.resolveCommand(commands(runtime)) !== null ||
      runtime.hasMacApplication(MAC_APPLICATION)
    );
  },
  async launch(input, runtime) {
    const command = runtime.resolveCommand(commands(runtime));
    if (command) {
      await runtime.spawnDetached({ command, args: [input.workspacePath] });
      return;
    }
    if (runtime.hasMacApplication(MAC_APPLICATION)) {
      await runtime.openMacApplication({
        applicationName: MAC_APPLICATION,
        paths: [input.workspacePath],
      });
      return;
    }
    throw new Error("GitHub Desktop is not installed");
  },
};
