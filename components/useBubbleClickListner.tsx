import { DeviceEventEmitter, NativeModules } from 'react-native';
import { useRef, useEffect, useContext } from 'react';

export default function useBubbleClickListner(singleClick, doubleClick, tripleClick) {


  const { InstalledApps } = NativeModules;

  const LaunchApp = (packageName) => {
    InstalledApps.launchApp(packageName)
      .then(() => {
        console.log('App launched');
      })
      .catch((error) => {
        console.error('Launch failed:', error);
      });
  };

  const clickCount = useRef([]);
  useEffect(() => {
    let clickTimeout;

    const subscription = DeviceEventEmitter.addListener('floating-bubble-press', () => {
      const Now = new Date().getTime();
      clickCount.current.push(Now);

      // Filter old clicks (within 500ms)
      clickCount.current = clickCount.current.filter((time) => Now - time <= 500);

      // Clear any previous timer
      if (clickTimeout) clearTimeout(clickTimeout);

      // Wait 300ms before deciding how many clicks we got 
      clickTimeout = setTimeout(() => {
        const clicks = clickCount.current.length;

        if (clicks === 1) {
          if (singleClick?.task === "Launch App") {
            LaunchApp(singleClick?.packageName)
          }
        } else if (clicks === 2) {
          if (doubleClick?.task === "Launch App") LaunchApp(doubleClick?.packageName)// double

        } else if (clicks === 3) {
          if (tripleClick?.task === "Launch App") LaunchApp(tripleClick?.packageName) // triple
        }

        clickCount.current = []; // reset after action
      }, 300); // wait to check if more clicks come
    });

    return () => {
      subscription.remove();
      if (clickTimeout) clearTimeout(clickTimeout);
    };
  }, [singleClick, doubleClick, tripleClick]);

}