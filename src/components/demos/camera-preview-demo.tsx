import { useEffect, useState } from "react";
import { PermissionsAndroid, Platform, Text, View } from "react-native";
import ExpoCameraPreviewView from "../../../modules/expo-camera-preview/src/ExpoCameraPreviewView";

export default function CameraPreviewDemo() {
  const [permissionChecked, setPermissionChecked] = useState(Platform.OS !== "android");

  useEffect(() => {
    if (Platform.OS === "android") {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA).finally(() =>
        setPermissionChecked(true),
      );
    }
  }, []);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ marginBottom: 8 }}>
        Camera preview below (black on iOS Simulator — no camera hardware; needs a real device)
      </Text>
      {permissionChecked && (
        <ExpoCameraPreviewView style={{ flex: 1, backgroundColor: "black", borderRadius: 8 }} />
      )}
    </View>
  );
}
