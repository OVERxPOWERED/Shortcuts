import { DeviceEventEmitter, NativeModules } from 'react-native';
import { useRef, useEffect, useLayoutEffect } from 'react';
import PerformanceProfiler from '../services/performanceProfiler';
import TelemetryService from '../services/telemetryService';
import PerformanceMonitor from '../services/performanceMonitor';

export default function useBubbleClickListner(singleClick, doubleClick, tripleClick) {
  const { InstalledApps } = NativeModules;

  const clickCount = useRef([]);
  const profilerRef = useRef(null);
  const renderStartRef = useRef(0);
  const memoryBaselineRef = useRef(0);

  const LaunchApp = (packageName) => {
    InstalledApps.launchApp(packageName)
      .then(() => {
        console.log('App launched');
      })
      .catch((error) => {
        console.error('Launch failed:', error);
      });
  };

  useEffect(() => {
    profilerRef.current = PerformanceProfiler.getInstance();
    profilerRef.current.initialize();
    memoryBaselineRef.current = PerformanceMonitor.getMemoryUsage();

    return () => {
      if (profilerRef.current) {
        profilerRef.current.cleanup();
      }
    };
  }, []);

  useLayoutEffect(() => {
    renderStartRef.current = performance.now();
  });

  useEffect(() => {
    let clickTimeout;

    const subscription = DeviceEventEmitter.addListener('floating-bubble-press', (event) => {
      const eventTimestamp = event?.timestamp || new Date().getTime();
      const handlerStart = performance.now();

      const profileId = profilerRef.current?.profileBubbleTap('tap', async () => {
        const Now = new Date().getTime();
        clickCount.current.push(Now);

        clickCount.current = clickCount.current.filter((time) => Now - time <= 500);

        if (clickTimeout) clearTimeout(clickTimeout);

        clickTimeout = setTimeout(() => {
          const clicks = clickCount.current.length;
          const handlerEnd = performance.now();
          const tapLatency = handlerEnd - eventTimestamp;
          const handlerDuration = handlerEnd - handlerStart;
          const renderTime = performance.now() - renderStartRef.current;
          const currentMemory = PerformanceMonitor.getMemoryUsage();
          const memoryDelta = currentMemory - memoryBaselineRef.current;

          const metrics = {
            tapLatency,
            handlerDuration,
            renderTime,
            memoryDelta,
            clickCount: clicks,
            timestamp: Now,
          };

          TelemetryService.sendPerformance('bubble_interaction', metrics);

          if (clicks === 1) {
            if (singleClick?.task === "Launch App") {
              LaunchApp(singleClick?.packageName);
            }
          } else if (clicks === 2) {
            if (doubleClick?.task === "Launch App") LaunchApp(doubleClick?.packageName);
          } else if (clicks === 3) {
            if (tripleClick?.task === "Launch App") LaunchApp(tripleClick?.packageName);
          }

          clickCount.current = [];
          memoryBaselineRef.current = currentMemory;
        }, 300);
      });

      if (profileId) {
        profilerRef.current?.endProfile(profileId);
      }
    });

    return () => {
      subscription.remove();
      if (clickTimeout) clearTimeout(clickTimeout);
    };
  }, [singleClick, doubleClick, tripleClick]);
}