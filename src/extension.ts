import * as vscode from "vscode";

// API Response Types

/**
 * Represents a snapshot of Copilot quota usage at a specific point in time.
 */
interface QuotaSnapshot {
  /** The total number of entitled requests for the quota period. */
  entitlement: number;
  /** The number of overage requests made. */
  overage_count: number;
  /** Whether overage is permitted for this quota. */
  overage_permitted: boolean;
  /** The percentage of quota remaining (0-100). */
  percent_remaining: number;
  /** The unique identifier for the quota. */
  quota_id: string;
  /** The number of requests remaining in the quota. */
  quota_remaining: number;
  /** The number of requests remaining (alias for quota_remaining). */
  remaining: number;
  /** Whether the quota is unlimited. */
  unlimited: boolean;
  /** The timestamp of when this snapshot was taken (UTC). */
  timestamp_utc: string;
}

/**
 * Represents a GitHub organization associated with the Copilot account.
 */
interface Organization {
  /** The login/handle of the organization. */
  login: string;
  /** The display name of the organization. */
  name: string;
}

/**
 * Represents the various API endpoints used by Copilot.
 */
interface Endpoints {
  /** The main API endpoint URL. */
  api: string;
  /** The origin tracker endpoint URL. */
  "origin-tracker": string;
  /** The proxy endpoint URL. */
  proxy: string;
  /** The telemetry endpoint URL. */
  telemetry: string;
}

/**
 * Contains quota snapshots for different Copilot interaction types.
 */
interface QuotaSnapshots {
  /** Quota snapshot for chat interactions. */
  chat: QuotaSnapshot;
  /** Quota snapshot for code completions. */
  completions: QuotaSnapshot;
  /** Quota snapshot for premium interactions (primary usage metric). */
  premium_interactions: QuotaSnapshot;
}

/**
 * Represents the complete API response from the Copilot internal user endpoint.
 *
 * This interface contains all the data returned by the GitHub Copilot internal API,
 * including account details, organization associations, and quota information.
 */
interface CopilotApiResponse {
  /** The user's login/username. */
  login: string;
  /** The access type SKU for the Copilot subscription. */
  access_type_sku: string;
  /** The analytics tracking identifier. */
  analytics_tracking_id: string;
  /** The date when Copilot was assigned to the user. */
  assigned_date: string;
  /** Whether the user can sign up for limited Copilot access. */
  can_signup_for_limited: boolean;
  /** Whether chat functionality is enabled for the user. */
  chat_enabled: boolean;
  /** Whether .copilotignore file support is enabled. */
  copilotignore_enabled: boolean;
  /** The Copilot plan identifier (e.g., "business", "individual"). */
  copilot_plan: string;
  /** Whether MCP (Model Context Protocol) is enabled. */
  is_mcp_enabled: boolean;
  /** List of organization logins associated with the account. */
  organization_login_list: string[];
  /** Detailed list of organizations associated with the account. */
  organization_list: Organization[];
  /** Whether restricted telemetry mode is enabled. */
  restricted_telemetry: boolean;
  /** The API endpoints used by Copilot. */
  endpoints: Endpoints;
  /** The date when the quota resets. */
  quota_reset_date: string;
  /** Quota usage snapshots for different interaction types. */
  quota_snapshots: QuotaSnapshots;
  /** The quota reset date in UTC format. */
  quota_reset_date_utc: string;
}

// Cache Types

/** Current cache version format - increment when API response structure changes. */
const CACHE_VERSION = "1.0";

/**
 * Represents cached API response data with version control.
 *
 * The cache includes a version field to handle API response structure changes
 * and a timestamp for cache invalidation.
 */
interface CacheData {
  /** The cache version format. */
  version: string;
  /** Unix timestamp when the cache was created. */
  timestamp: number;
  /** The cached API response data. */
  data: CopilotApiResponse;
}

// Usage Display Types

/**
 * Represents processed Copilot usage data for display in the status bar.
 *
 * This data is extracted from the API response and formatted for display,
 * showing the percentage of quota used along with absolute numbers.
 */
interface UsageData {
  /** The percentage of quota used (0-100). */
  percentage: number;
  /** The number of requests used. */
  used: number;
  /** The total number of entitled requests. */
  entitlement: number;
}

/** Global state key for storing cached Copilot usage data. */
const CACHE_KEY = "copilotUsage.cache";

/**
 * Activates the Copilot Usage extension.
 *
 * Sets up a status bar item that displays the current GitHub Copilot premium
 * request usage percentage. The extension periodically fetches usage data from
 * the GitHub Copilot internal API, caches it in global state, and updates the
 * status bar display. It also registers commands for toggling the label style,
 * adjusting the refresh interval, and switching the display mode between used
 * and remaining percentages.
 *
 * @param context - The VSCode extension context providing access to global state
 *   and subscription management.
 */
export function activate(context: vscode.ExtensionContext): void {
  /**
   * Retrieves the current Copilot usage configuration.
   *
   * Re-fetches on every call to avoid stale values after runtime changes.
   *
   * @returns The current workspace configuration for the "copilotUsage" section.
   */
  function getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("copilotUsage");
  }

  const priority = getConfig().get<number>("statusBarPriority", -1000);

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    priority,
  );
  statusBarItem.command = undefined;
  statusBarItem.text = "Copilot: ...";
  statusBarItem.show();

  /**
   * Retrieves cached Copilot usage data from global state.
   *
   * @returns The cached data if valid and version matches, otherwise null.
   */
  function getCache(): CacheData | null {
    const cache = context.globalState.get<CacheData>(CACHE_KEY);
    if (!cache || cache.version !== CACHE_VERSION) {
      return null;
    }
    return cache;
  }

  /**
   * Stores Copilot API response data in the global state cache.
   *
   * @param data - The API response data to cache.
   */
  function setCache(data: CopilotApiResponse): void {
    const cacheData: CacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    context.globalState.update(CACHE_KEY, cacheData);
  }

  /**
   * Checks whether cached data is still valid based on the refresh interval.
   *
   * @param cache - The cache data to validate.
   * @returns True if the cache is valid and within the refresh interval, false otherwise.
   */
  function isCacheValid(cache: CacheData | null): boolean {
    if (!cache) {
      return false;
    }
    const refreshIntervalMs = getRefreshInterval();
    return Date.now() - cache.timestamp < refreshIntervalMs;
  }

  /**
   * Extracts and processes usage data from the Copilot API response.
   *
   * This function attempts to calculate usage percentage from the premium_interactions
   * quota snapshot. It prefers the API's percent_remaining value when available,
   * but falls back to manual calculation (entitlement - quota_remaining) if needed.
   *
   * @param data - The API response data containing quota information.
   * @returns Processed usage data with percentage, used count, and entitlement, or null if extraction fails.
   */
  function extractUsageData(data: CopilotApiResponse): UsageData | null {
    const premiumInteractions = data.quota_snapshots?.premium_interactions;

    if (!premiumInteractions) {
      return null;
    }

    const { entitlement, quota_remaining, percent_remaining } =
      premiumInteractions;

    if (entitlement === 0) {
      return null;
    }

    // Use API's percent_remaining if available and valid
    if (percent_remaining !== undefined && !Number.isNaN(percent_remaining)) {
      const percentage = 100 - percent_remaining;
      const used = Math.round((percentage / 100) * entitlement);
      return {
        percentage: Math.round(percentage * 10) / 10,
        used,
        entitlement,
      };
    }

    // Fallback to manual calculation
    const used = entitlement - quota_remaining;
    const percentage = (used / entitlement) * 100;

    return {
      percentage: Math.round(percentage * 10) / 10,
      used,
      entitlement,
    };
  }

  /**
   * Fetches Copilot usage data from the GitHub internal API.
   *
   * This function authenticates using GitHub authentication, then calls the
   * copilot_internal/user endpoint to retrieve quota and usage information.
   *
   * @returns The API response data, or null if authentication fails or an error occurs.
   */
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

  /**
   * Fetches usage data with intelligent caching.
   *
   * This function implements a multi-tier strategy:
   * 1. Returns valid cached data if available
   * 2. Fetches fresh data from API if cache is invalid
   * 3. Falls back to expired cache if API call fails
   * 4. Returns null if no data is available
   *
   * @returns An object containing the usage data (or null) and whether an API call was made.
   */
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

  /**
   * Updates the status bar item with the latest Copilot usage data.
   *
   * This function fetches usage data, formats it according to user settings,
   * and updates the status bar item text and tooltip. If an API call was made,
   * it also resets the refresh timer to ensure proper interval timing.
   */
  async function updateStatusBar() {
    const { usage, apiCalled } = await fetchUsage();
    const label = getLabel();
    const style = getLabelStyle();
    const displayMode = getDisplayMode();
    const separator = style === "text" ? ":" : "";

    if (usage === null) {
      statusBarItem.text = `${label}${separator} -`;
      statusBarItem.tooltip = "Unable to fetch Copilot usage data";
    } else {
      let displayValue: number;
      let tooltipText: string;

      if (displayMode === "remaining") {
        displayValue = Math.round((100 - usage.percentage) * 10) / 10;
        const remaining = usage.entitlement - usage.used;
        tooltipText = `Premium Requests: ${displayValue}% (remaining: ${remaining}/${usage.entitlement})`;
      } else {
        displayValue = usage.percentage;
        tooltipText = `Premium Requests: ${usage.percentage}% (used: ${usage.used}/${usage.entitlement})`;
      }

      statusBarItem.text = `${label}${separator} ${displayValue}%`;
      statusBarItem.tooltip = tooltipText;
    }

    if (apiCalled) {
      startInterval();
    }
  }

  /**
   * Retrieves the configured refresh interval in milliseconds.
   *
   * @returns The refresh interval in milliseconds.
   */
  function getRefreshInterval(): number {
    return getConfig().get<number>("refreshInterval", 60) * 1000;
  }

  /**
   * Retrieves the configured display mode for usage data.
   *
   * @returns The display mode: "used" shows consumed percentage, "remaining" shows leftover percentage.
   */
  function getDisplayMode(): "used" | "remaining" {
    return getConfig().get<"used" | "remaining">("displayMode", "used");
  }

  /**
   * Retrieves the configured status bar label style.
   *
   * @returns The label style: "icon" for Copilot icon, "text" for "Copilot" text.
   */
  function getLabelStyle(): "icon" | "text" {
    return getConfig().get<"icon" | "text">("labelStyle", "icon");
  }

  /**
   * Determines whether the current VSCode theme is dark.
   *
   * @returns True if the current theme is dark, false otherwise.
   */
  function isDarkTheme(): boolean {
    const colorTheme = vscode.window.activeColorTheme;
    return colorTheme.kind === vscode.ColorThemeKind.Dark;
  }

  /**
   * Retrieves the status bar label based on the configured style and theme.
   *
   * Returns the Copilot icon appropriate for the current theme when using icon style,
   * or returns "Copilot" text when using text style.
   *
   * @returns The label string to display in the status bar.
   */
  function getLabel(): string {
    const style = getLabelStyle();
    if (style === "text") {
      return "Copilot";
    }
    // Use custom icon based on theme
    return isDarkTheme() ? "$(copilot-dark)" : "$(copilot-light)";
  }

  let intervalId: ReturnType<typeof setInterval> | undefined;

  /**
   * Starts or restarts the periodic status bar update timer.
   *
   * Clears any existing timer and creates a new one based on the configured
   * refresh interval. This ensures the timer is reset after API calls complete,
   * maintaining accurate timing intervals.
   */
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
      const newStyle = getLabelStyle() === "icon" ? "text" : "icon";
      const config = vscode.workspace.getConfiguration("copilotUsage");
      await config.update(
        "labelStyle",
        newStyle,
        vscode.ConfigurationTarget.Global,
      );
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
      if (input === undefined) {
        return;
      }
      const config = vscode.workspace.getConfiguration("copilotUsage");
      await config.update(
        "refreshInterval",
        Number(input),
        vscode.ConfigurationTarget.Global,
      );
      vscode.window.showInformationMessage(
        `Copilot Usage: Refresh interval set to ${input} seconds`,
      );
    },
  );

  const toggleDisplayModeCommand = vscode.commands.registerCommand(
    "copilotUsage.toggleDisplayMode",
    async () => {
      const newMode = getDisplayMode() === "used" ? "remaining" : "used";
      const config = vscode.workspace.getConfiguration("copilotUsage");
      await config.update(
        "displayMode",
        newMode,
        vscode.ConfigurationTarget.Global,
      );
      startInterval();
      await updateStatusBar();
      vscode.window.showInformationMessage(
        `Copilot Usage: Display mode changed to "${newMode}"`,
      );
    },
  );

  context.subscriptions.push(
    statusBarItem,
    toggleLabelStyleCommand,
    setRefreshIntervalCommand,
    toggleDisplayModeCommand,
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("copilotUsage.refreshInterval")) {
        startInterval();
      }
      if (
        e.affectsConfiguration("copilotUsage.labelStyle") ||
        e.affectsConfiguration("copilotUsage.displayMode")
      ) {
        updateStatusBar();
      }
      if (e.affectsConfiguration("copilotUsage.statusBarPriority")) {
        const selection = await vscode.window.showInformationMessage(
          "Copilot Usage: Status bar priority changed. Reload the window to apply.",
          "Reload Window",
        );
        if (selection === "Reload Window") {
          await vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      }
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      if (getLabelStyle() === "icon") updateStatusBar();
    }),
    { dispose: () => intervalId !== undefined && clearInterval(intervalId) },
  );
}

/**
 * Deactivates the Copilot Usage extension.
 *
 * Cleanup is handled automatically via disposables registered in `context.subscriptions`
 * during activation, so no additional teardown is required here.
 */
export function deactivate() {
  // No cleanup needed
}
