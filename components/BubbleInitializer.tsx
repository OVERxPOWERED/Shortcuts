import { showFloatingBubble, hideFloatingBubble, requestPermission, initialize } from "react-native-floating-bubble";
import { NativeModules } from "react-native";

const { OverlayPermissionModule } = NativeModules;

function initializeBubble() {
  initialize();
}

async function requestBubblePermission(): Promise<boolean> {
  try {
    const result = await OverlayPermissionModule.canDrawOverlays();
    if (result) {
      initializeBubble();
      return true;
    } else {
      requestPermission();
      const resultAfter = await OverlayPermissionModule.canDrawOverlays();
      if (resultAfter) {
        initializeBubble();
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Overlay permission check failed:", error);
    return false;
  }
}

export async function showBubble(bubbleVisibility: boolean, setBubbleVisibility: (val: boolean) => void) {
  const permission = await requestBubblePermission();
  if (!bubbleVisibility && permission) {
    showFloatingBubble();
    setBubbleVisibility(true);
  }
}

export function hideBubble(bubbleVisibility: boolean, setBubbleVisibility: (val: boolean) => void) {
  if (bubbleVisibility) {
    // hideFloatingBubble();
    setBubbleVisibility(false);
  }
}
