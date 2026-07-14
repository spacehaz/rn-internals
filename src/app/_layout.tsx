import { DarkTheme, DefaultTheme, router, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { jsStartTime, reportStartupMetric } from '@/lib/performance';
import NativeDeviceInfo from '../../specs/NativeCustomDeviceInfo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function navigateFromNotificationData(data: Record<string, unknown>) {
  const route = data?.route;
  if (typeof route === 'string') {
    router.push(route as any);
  }
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // Runs once, after the first commit. Reports three numbers:
  // - js-start-to-first-render: the "JS bundle parse time" piece — bundle
  //   load + Hermes bytecode init + module evaluation + first React render.
  // - native-start-to-js-start: the previously-invisible native bootstrap
  //   phase (OS process launch, AppDelegate/MainApplication init, spinning
  //   up the Hermes VM and loading the bundle off disk) — only measurable
  //   because of the AppDelegate/MainApplication timestamp we added.
  // - native-start-to-first-render: the full end-to-end number, closest to
  //   what a real user actually experiences from tapping the app icon.
  useEffect(() => {
    const now = Date.now();
    reportStartupMetric('js-start-to-first-render', now - jsStartTime);

    const nativeStartTimeMs = NativeDeviceInfo.getNativeStartTime();
    reportStartupMetric('native-start-to-js-start', jsStartTime - nativeStartTimeMs);
    reportStartupMetric('native-start-to-first-render', now - nativeStartTimeMs);
  }, []);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[notifications] received while foregrounded:', notification.request.content);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotificationData(response.notification.request.content.data);
    });

    // Cold start: the app was fully terminated and this launch was caused by
    // tapping a notification — the listener above only catches taps that happen
    // while the app is already running (foregrounded or backgrounded), so this
    // is a separate check needed specifically for the terminated case.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateFromNotificationData(response.notification.request.content.data);
        Notifications.clearLastNotificationResponseAsync();
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
