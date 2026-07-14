import { useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import NativeDeviceInfo from "../../../specs/NativeCustomDeviceInfo";

export default function DeviceInfoDemo() {
  const [model, setModel] = useState<string>("");
  const [systemVersion, setSystemVersion] = useState<string>("");
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  const runChecks = useCallback(async () => {
    setModel(NativeDeviceInfo.getModel());
    setSystemVersion(NativeDeviceInfo.getSystemVersion());
    const level = await NativeDeviceInfo.getBatteryLevel();
    setBatteryLevel(level);
  }, []);

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#0ea5e9", borderRadius: 8 }}
        onPress={runChecks}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Call native module</Text>
      </TouchableOpacity>
      <Text>Model: {model || "(not called yet)"}</Text>
      <Text>System version: {systemVersion || "(not called yet)"}</Text>
      <Text>Battery level: {batteryLevel !== null ? `${batteryLevel}%` : "(not called yet)"}</Text>
    </View>
  );
}
