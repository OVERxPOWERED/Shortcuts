```tsx
import React, { useEffect, useCallback, useRef } from "react";
import {
  showFloatingBubble,
  hideFloatingBubble,
  requestPermission,
  initialize,
  useBubbleClickListener,
} from "react-native-floating-bubble";
import { NativeModules, Platform, Linking, Alert } from "react-native";
import { ShortcutsService } from "../services/ShortcutsService";
import { Shortcut } from "../types/shortcut";
import { HealthCheckService } from "../services/HealthCheckService";
import { TelemetryService } from "../services/TelemetryService";

const { OverlayPermissionModule, FloatingBubbleManager } = NativeModules;

interface BubbleConfig {
  shortcuts: Shortcut[];
  onShortcutExecute: (shortcut: Shortcut) => Promise<void>;
}

let bubbleInitialized = false;
let currentConfig: BubbleConfig | null = null;

async function initializeBubble(config: BubbleConfig): Promise<void> {
  if (bubbleInitialized) {
    return;
  }

  try {
    currentConfig = config;
    
    if (Platform.OS === "android") {
      await initialize({
        icon: require("../assets/bubble-icon.png"),
        initialX: 100,
        initialY: 100,
        onClick: handleBubbleClick,
        onLongClick: handleBubbleLongClick,
      });
    }
    
    bubbleInitialized = true;
  } catch (error) {
    console.error("Failed to initialize bubble:", error);
    throw error;
  }
}

async function handleBubbleClick(): Promise<void> {
  if (!currentConfig || currentConfig.shortcuts.length === 0) {
    return;
  }

  const shortcut = currentConfig.shortcuts[0];
  await executeShortcut(shortcut, currentConfig.onShortcutExecute);
}

async function handleBubbleLongClick(): Promise<void> {
  if (!currentConfig || currentConfig.shortcuts.length <= 1) {
    return;
  }

  const shortcut = currentConfig.shortcuts[1];
  await executeShortcut(shortcut, currentConfig.onShortcutExecute);
}

async function executeShortcut(
  shortcut: Shortcut,
  onExecute: (shortcut: Shortcut) => Promise<void>
): Promise<void> {
  try {
    await onExecute(shortcut);
  } catch (error) {
    console.error(`Failed to execute shortcut ${shortcut.id}:`, error);
    showErrorAlert(`Failed to execute "${shortcut.label}"`);
  }
}

function showErrorAlert(message: string): void {
  Alert.alert("Error", message, [{ text: "OK" }]);
}

async function requestBubblePermission(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }

  try {
    if (!OverlayPermissionModule) {
      console.warn("OverlayPermissionModule not available");
      return false;
    }

    const result = await OverlayPermissionModule.canDrawOverlays();
    if (result) {
      return true;
    }

    requestPermission();
    
    const resultAfter = await OverlayPermissionModule.canDrawOverlays();
    return resultAfter;
  } catch (error) {
    console.error("Overlay permission check failed:", error);
    return false;
  }
}

async function checkBubbleConnectivity(): Promise<boolean> {
  if (Platform.OS !== "android" || !FloatingBubbleManager) {
    return true;
  }

  try {
    const isConnected = await FloatingBubbleManager.isBubbleConnected?.();
    return isConnected ?? true;
  } catch (error) {
    console.warn("Bubble connectivity check failed:", error);
    return false;
  }
}

export function useBubbleInitializer(
  bubbleVisibility: boolean,
  setBubbleVisibility: (val: boolean) => void,
  shortcuts: Shortcut[] = [],
  onShortcutExecute?: (shortcut: Shortcut) => Promise<void>
): void {
  const healthCheckServiceRef = useRef<HealthCheckService | null>(null);
  const telemetryServiceRef = useRef<TelemetryService | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    healthCheckServiceRef.current = HealthCheckService.getInstance();
    telemetryServiceRef.current = TelemetryService.getInstance();

    const healthCheckService = healthCheckServiceRef.current;
    const telemetryService = telemetryServiceRef.current;

    const handleReport = (report: any) => {
      if (!isMountedRef.current) return;
      
      telemetryService.trackPerformance("health_check_report", {
        timestamp: report.timestamp,
        checks: report.results.map((r: any) => ({
          name: r.name,
          status: r.status,
          latencyMs: r.latencyMs,
          details: r.details,
        })),
        overallStatus: report.overallStatus,
      });
    };

    const handleError = (error: Error, context?: string) => {
      if (!isMountedRef.current) return;
      
      telemetryService.trackError(error, {
        context: context ?? "health_check",
        timestamp: Date.now(),
      });
    };

    healthCheckService.onReport(handleReport);
    healthCheckService.onError(handleError);

    const startPeriodicHealthChecks = async () => {
      const runChecks = async () => {
        if (!isMountedRef.current) return;

        try {
          const bubbleConnected = await checkBubbleConnectivity();
          
          await healthCheckService.runChecks({
            checks: ["storage", "shortcuts", "bubble", "performance"],
            bubbleConnectivity: bubbleConnected,
            shortcutCount: shortcuts.length,
          });
        } catch (error) {
          handleError(error as Error, "periodic_health_check");
        }
      };

      await runChecks();
      
      intervalRef.current = setInterval(runChecks, 60_000);
    };

    startPeriodicHealthChecks();

    return () => {
      isMountedRef.current = false;
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (healthCheckServiceRef.current) {
        healthCheckServiceRef.current.offReport(handleReport);
        healthCheckServiceRef.current.offError(handleError);
      }
    };
  }, [shortcuts.length]);

  const showBubbleHandler = useCallback(async () => {
    const permission = await requestBubblePermission();
    
    if (!permission) {
      showErrorAlert("Overlay permission is required to show the floating bubble");
      return;
    }

    if (!bubbleVisibility) {
      try {
        const executeHandler = onShortcutExecute ?? defaultShortcutExecutor;
        await initializeBubble({ shortcuts, onShortcutExecute: executeHandler });
        showFloatingBubble();
        setBubbleVisibility(true);
      } catch (error) {
        console.error("Failed to show bubble:", error);
        showErrorAlert("Failed to show floating bubble");
      }
    }
  }, [bubbleVisibility, shortcuts, onShortcutExecute, setBubbleVisibility]);

  const hideBubbleHandler = useCallback(() => {
    if (bubbleVisibility) {
      hideFloatingBubble();
      setBubbleVisibility(false);
    }
  }, [bubbleVisibility, setBubbleVisibility]);

  return { showBubble: showBubbleHandler, hideBubble: hideBubbleHandler };
}

async function defaultShortcutExecutor(shortcut: Shortcut): Promise<void>