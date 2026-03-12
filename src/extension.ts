import * as vscode from "vscode";

// API Response Types
interface QuotaSnapshot {
  entitlement: number;
  overage_count: number;
  overage_permitted: boolean;
  percent_remaining: number;
  quota_id: string;
  quota_remaining: number;
  remaining: number;
  unlimited: boolean;
  timestamp_utc: string;
}

interface Organization {
  login: string;
  name: string;
}

interface Endpoints {
  api: string;
  "origin-tracker": string;
  proxy: string;
  telemetry: string;
}

interface QuotaSnapshots {
  chat: QuotaSnapshot;
  completions: QuotaSnapshot;
  premium_interactions: QuotaSnapshot;
}

interface CopilotApiResponse {
  login: string;
  access_type_sku: string;
  analytics_tracking_id: string;
  assigned_date: string;
  can_signup_for_limited: boolean;
  chat_enabled: boolean;
  copilotignore_enabled: boolean;
  copilot_plan: string;
  is_mcp_enabled: boolean;
  organization_login_list: string[];
  organization_list: Organization[];
  restricted_telemetry: boolean;
  endpoints: Endpoints;
  quota_reset_date: string;
  quota_snapshots: QuotaSnapshots;
  quota_reset_date_utc: string;
}

// Cache Types
const CACHE_VERSION = "1.0";

interface CacheData {
  version: string;
  timestamp: number;
  data: CopilotApiResponse;
}

// Usage Display Types
interface UsageData {
  percentage: number;
  used: number;
  entitlement: number;
}

const CACHE_KEY = "copilotUsage.cache";

/**
 * Activates the extension.
 * @param context - The extension context provided by VSCode.
 */
export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = undefined;
  statusBarItem.text = "Copilot: ..."; // Will be updated by updateStatusBar
  statusBarItem.show();

  function getCache(): CacheData | null {
    const cache = context.globalState.get<CacheData>(CACHE_KEY);
    if (!cache || cache.version !== CACHE_VERSION) {
      return null;
    }
    return cache;
  }

  function setCache(data: CopilotApiResponse): void {
    const cacheData: CacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    context.globalState.update(CACHE_KEY, cacheData);
  }

  function isCacheValid(cache: CacheData | null): boolean {
    if (!cache) {
      return false;
    }
    const refreshIntervalMs = getRefreshInterval();
    return Date.now() - cache.timestamp < refreshIntervalMs;
  }

  function extractUsageData(data: CopilotApiResponse): UsageData | null {
    const premiumInteractions = data.quota_snapshots?.premium_interactions;

    if (!premiumInteractions) {
      return null;
    }

    const { entitlement, quota_remaining } = premiumInteractions;

    if (entitlement === 0) {
      return null;
    }

    const used = entitlement - quota_remaining;
    const percentage = (used / entitlement) * 100;

    return {
      percentage: Math.round(percentage * 10) / 10,
      used,
      entitlement,
    };
  }

  async function fetchFromApi(): Promise<CopilotApiResponse | null> {
    try {
      const session = await vscode.authentication.getSession(
        "github",
        ["user:email"],
        {
          createIfNone: true,
        },
      );

      if (!session) {
        return null;
      }

      const response = await fetch(
        "https://api.github.com/copilot_internal/user",
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "User-Agent": "VSCode-Copilot-Usage-Extension",
          },
        },
      );

      if (!response.ok) {
        console.error(
          "[Copilot Usage] API error:",
          response.status,
          await response.text(),
        );
        return null;
      }

      const data: CopilotApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error("[Copilot Usage] Error:", error);
      return null;
    }
  }

  async function fetchUsage(): Promise<{
    usage: UsageData | null;
    apiCalled: boolean;
  }> {
    const cache = getCache();

    if (cache && isCacheValid(cache)) {
      return { usage: extractUsageData(cache.data), apiCalled: false };
    }

    const apiData = await fetchFromApi();

    if (apiData) {
      setCache(apiData);
      return { usage: extractUsageData(apiData), apiCalled: true };
    }

    // Fallback to expired cache if API fails
    if (cache) {
      return { usage: extractUsageData(cache.data), apiCalled: false };
    }

    return { usage: null, apiCalled: false };
  }

  async function updateStatusBar() {
    const { usage, apiCalled } = await fetchUsage();
    const label = getLabel();
    const style = getLabelStyle();

    // Use colon only for text style
    const separator = style === "text" ? ":" : "";

    if (usage === null) {
      statusBarItem.text = `${label}${separator} -`;
      statusBarItem.tooltip = "Unable to fetch Copilot usage data";
    } else {
      statusBarItem.text = `${label}${separator} ${usage.percentage}%`;
      statusBarItem.tooltip = `Premium Requests: ${usage.percentage}% (${usage.used}/${usage.entitlement})`;
    }

    if (apiCalled) {
      startInterval();
    }
  }

  function getRefreshInterval(): number {
    const config = vscode.workspace.getConfiguration("copilotUsage");
    const seconds = config.get<number>("refreshInterval", 60);
    return seconds * 1000;
  }

  function getLabelStyle(): "icon" | "text" {
    const config = vscode.workspace.getConfiguration("copilotUsage");
    return config.get<"icon" | "text">("labelStyle", "icon");
  }

  function isDarkTheme(): boolean {
    const colorTheme = vscode.window.activeColorTheme;
    return colorTheme.kind === vscode.ColorThemeKind.Dark;
  }

  function getLabel(): string {
    const style = getLabelStyle();
    if (style === "text") {
      return "Copilot";
    }
    // Use custom icon based on theme
    return isDarkTheme() ? "$(copilot-dark)" : "$(copilot-light)";
  }

  let intervalId: ReturnType<typeof setInterval> | undefined;

  function startInterval() {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(updateStatusBar, getRefreshInterval());
  }

  updateStatusBar();
  startInterval();

  // Register commands
  const toggleLabelStyleCommand = vscode.commands.registerCommand(
    "copilotUsage.toggleLabelStyle",
    async () => {
      const currentStyle = getLabelStyle();
      const newStyle = currentStyle === "icon" ? "text" : "icon";
      const config = vscode.workspace.getConfiguration("copilotUsage");
      await config.update("labelStyle", newStyle, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `Copilot Usage: Label style changed to "${newStyle}"`,
      );
    },
  );

  const setRefreshIntervalCommand = vscode.commands.registerCommand(
    "copilotUsage.setRefreshInterval",
    async () => {
      const currentInterval = getRefreshInterval() / 1000;
      const input = await vscode.window.showInputBox({
        prompt: "Refresh interval in seconds",
        value: String(currentInterval),
        validateInput: (value) => {
          const num = Number(value);
          if (Number.isNaN(num) || num < 1) {
            return "Please enter a positive number";
          }
          return null;
        },
      });
      if (input !== undefined) {
        const config = vscode.workspace.getConfiguration("copilotUsage");
        await config.update(
          "refreshInterval",
          Number(input),
          vscode.ConfigurationTarget.Global,
        );
        vscode.window.showInformationMessage(
          `Copilot Usage: Refresh interval set to ${input} seconds`,
        );
      }
    },
  );

  context.subscriptions.push(
    statusBarItem,
    toggleLabelStyleCommand,
    setRefreshIntervalCommand,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("copilotUsage.refreshInterval")) {
        startInterval();
      }
      if (e.affectsConfiguration("copilotUsage.labelStyle")) {
        updateStatusBar();
      }
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      if (getLabelStyle() === "icon") {
        updateStatusBar();
      }
    }),
    {
      dispose: () => {
        if (intervalId !== undefined) clearInterval(intervalId);
      },
    },
  );
}

/**
 * Deactivates the extension.
 * Called when VSCode is shutting down or the extension is disabled.
 */
export function deactivate() {}
