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

const { OverlayPermissionModule } = NativeModules;

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

export async function showBubble(
  bubbleVisibility: boolean,
  setBubbleVisibility: (val: boolean) => void,
  shortcuts: Shortcut[] = [],
  onShortcutExecute?: (shortcut: Shortcut) => Promise<void>
): Promise<void> {
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
}

export function hideBubble(
  bubbleVisibility: boolean,
  setBubbleVisibility: (val: boolean) => void
): void {
  if (bubbleVisibility) {
    hideFloatingBubble();
    setBubbleVisibility(false);
  }
}

async function defaultShortcutExecutor(shortcut: Shortcut): Promise<void> {
  switch (shortcut.actionType) {
    case "APP_SHORTCUT":
      await handleAppShortcut(shortcut);
      break;
    case "URL":
      await handleUrlShortcut(shortcut);
      break;
    case "SYSTEM_ACTION":
      await handleSystemAction(shortcut);
      break;
    case "CUSTOM":
      await handleCustomAction(shortcut);
      break;
    default:
      console.warn(`Unknown action type: ${(shortcut as any).actionType}`);
      throw new Error(`Unknown action type: ${(shortcut as any).actionType}`);
  }
}

async function handleAppShortcut(shortcut: Shortcut): Promise<void> {
  const { actionData } = shortcut;
  
  if (!actionData?.packageName) {
    throw new Error("Package name is required for APP_SHORTCUT");
  }

  if (Platform.OS === "android") {
    const { AppShortcutModule } = NativeModules;
    if (AppShortcutModule?.launchApp) {
      await AppShortcutModule.launchApp(actionData.packageName, actionData.className);
    } else {
      await Linking.openURL(`intent://#Intent;package=${actionData.packageName};end`);
    }
  } else {
    if (actionData.urlScheme) {
      await Linking.openURL(actionData.urlScheme);
    } else {
      throw new Error("URL scheme required for iOS app shortcuts");
    }
  }
}

async function handleUrlShortcut(shortcut: Shortcut): Promise<void> {
  const { actionData } = shortcut;
  
  if (!actionData?.url) {
    throw new Error("URL is required for URL shortcut");
  }

  const supported = await Linking.canOpenURL(actionData.url);
  if (!supported) {
    throw new Error(`Cannot open URL: ${actionData.url}`);
  }

  await Linking.openURL(actionData.url);
}

async function handleSystemAction(shortcut: Shortcut): Promise<void> {
  const { actionData } = shortcut;
  
  if (!actionData?.systemAction) {
    throw new Error("System action is required for SYSTEM_ACTION");
  }

  if (Platform.OS === "android") {
    const { SystemActionModule } = NativeModules;
    if (SystemActionModule?.executeAction) {
      await SystemActionModule.executeAction(actionData.systemAction, actionData.extras);
    } else {
      await executeSystemActionViaIntent(actionData.systemAction, actionData.extras);
    }
  } else {
    await executeSystemActionIOS(actionData.systemAction);
  }
}

async function executeSystemActionViaIntent(action: string, extras?: Record<string, any>): Promise<void> {
  const intentMap: Record<string, string> = {
    SETTINGS: "android.settings.SETTINGS",
    WIFI_SETTINGS: "android.settings.WIFI_SETTINGS",
    BLUETOOTH_SETTINGS: "android.settings.BLUETOOTH_SETTINGS",
    LOCATION_SETTINGS: "android.settings.LOCATION_SOURCE_SETTINGS",
    DISPLAY_SETTINGS: "android.settings.DISPLAY_SETTINGS