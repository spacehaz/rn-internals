import { useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import * as Notifications from "expo-notifications";

export default function NotificationsDemo() {
  const [permissionStatus, setPermissionStatus] = useState<string>("");
  const [tokenResult, setTokenResult] = useState<string>("");

  const requestPermission = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    setPermissionStatus(status);
  }, []);

  const fetchToken = useCallback(async () => {
    setTokenResult("...");
    try {
      const { data } = await Notifications.getExpoPushTokenAsync();
      setTokenResult(data);
    } catch (e: any) {
      setTokenResult(`error: ${e.message ?? String(e)}`);
    }
  }, []);

  const triggerLocalNotification = useCallback(async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "New message from Alice",
        body: "Hey, are you free?",
        data: { route: "/explore" },
      },
      trigger: null,
    });
  }, []);

  const triggerDelayedNotification = useCallback(async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "New message from Bob",
        body: "Delayed 5s — background or kill the app now",
        data: { route: "/explore" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
    });
  }, []);

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#0ea5e9", borderRadius: 8 }}
        onPress={requestPermission}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Request notification permission</Text>
      </TouchableOpacity>
      <Text>Permission status: {permissionStatus || "(not requested yet)"}</Text>

      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#22c55e", borderRadius: 8 }}
        onPress={fetchToken}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Get Expo push token</Text>
      </TouchableOpacity>
      <Text>Token: {tokenResult || "(not requested yet)"}</Text>

      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#f97316", borderRadius: 8 }}
        onPress={triggerLocalNotification}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Trigger local notification</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#dc2626", borderRadius: 8 }}
        onPress={triggerDelayedNotification}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Trigger delayed notification (5s)</Text>
      </TouchableOpacity>
    </View>
  );
}
