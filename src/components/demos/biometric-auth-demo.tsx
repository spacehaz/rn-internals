import { useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import NativeBiometricAuth from "../../../specs/NativeBiometricAuth";

export default function BiometricAuthDemo() {
  const [biometryType, setBiometryType] = useState<string>("");
  const [result, setResult] = useState<string>("");

  const checkType = useCallback(() => {
    setBiometryType(NativeBiometricAuth.getBiometryType());
  }, []);

  const runAuth = useCallback(async () => {
    setResult("...");
    try {
      const success = await NativeBiometricAuth.authenticate("Confirm it's you");
      setResult(success ? "success" : "failed");
    } catch (e: any) {
      setResult(`error: ${e.code ?? ""} ${e.message ?? String(e)}`);
    }
  }, []);

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#0ea5e9", borderRadius: 8 }}
        onPress={checkType}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Check biometry type</Text>
      </TouchableOpacity>
      <Text>Biometry type: {biometryType || "(not called yet)"}</Text>

      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#22c55e", borderRadius: 8 }}
        onPress={runAuth}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Authenticate</Text>
      </TouchableOpacity>
      <Text>Result: {result || "(not called yet)"}</Text>
    </View>
  );
}
