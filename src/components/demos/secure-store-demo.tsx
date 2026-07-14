import { useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "authToken";
const GATED_KEY = "gatedSecret";

export default function SecureStoreDemo() {
  const [tokenResult, setTokenResult] = useState<string>("");
  const [gatedResult, setGatedResult] = useState<string>("");

  // Plain secure storage — no biometric requirement. Still backed by
  // Keychain/Keystore (real secure hardware), just accessible without a
  // fresh auth check. This is the right home for something like a refresh
  // token: sensitive, but the app needs to read it silently on launch.
  const storeToken = useCallback(async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, `token-${Date.now()}`);
    setTokenResult("stored");
  }, []);

  const readToken = useCallback(async () => {
    const value = await SecureStore.getItemAsync(TOKEN_KEY);
    setTokenResult(value ?? "(not set)");
  }, []);

  // Biometric-gated secret — this is the piece Week 9's BiometricAuthModule
  // was missing. requireAuthentication: true ties the Keychain/Keystore item
  // itself to a fresh biometric check, enforced by the OS/secure hardware,
  // not by app logic that could be bypassed.
  //
  // Real, hard requirement (learned by hitting it): on iOS this needs actual
  // biometric enrollment (Face ID or Touch ID) — a device passcode alone is
  // NOT sufficient, even though the raw OS error message misleadingly
  // mentions "passphrase/PIN". canUseBiometricAuthentication() lets us detect
  // this upfront and fail with a clear message instead of a cryptic one.
  const storeGatedSecret = useCallback(async () => {
    if (!SecureStore.canUseBiometricAuthentication()) {
      setGatedResult("error: no biometric authentication enrolled on this device");
      return;
    }
    await SecureStore.setItemAsync(GATED_KEY, `secret-${Date.now()}`, {
      requireAuthentication: true,
      authenticationPrompt: "Confirm it's you to save this secret",
    });
    setGatedResult("stored");
  }, []);

  const readGatedSecret = useCallback(async () => {
    if (!SecureStore.canUseBiometricAuthentication()) {
      setGatedResult("error: no biometric authentication enrolled on this device");
      return;
    }
    setGatedResult("...");
    try {
      const value = await SecureStore.getItemAsync(GATED_KEY, {
        requireAuthentication: true,
        authenticationPrompt: "Confirm it's you to reveal this secret",
      });
      setGatedResult(value ?? "(not set)");
    } catch (e: any) {
      setGatedResult(`error: ${e.message ?? String(e)}`);
    }
  }, []);

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={{ fontWeight: "bold" }}>Plain secure storage (no biometric gate):</Text>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#0ea5e9", borderRadius: 8 }}
        onPress={storeToken}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Store token</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#22c55e", borderRadius: 8 }}
        onPress={readToken}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Read token</Text>
      </TouchableOpacity>
      <Text>Result: {tokenResult || "(not read yet)"}</Text>

      <Text style={{ fontWeight: "bold", marginTop: 16 }}>Biometric-gated secret:</Text>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#f97316", borderRadius: 8 }}
        onPress={storeGatedSecret}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Store gated secret</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#dc2626", borderRadius: 8 }}
        onPress={readGatedSecret}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Read gated secret (triggers Face ID)</Text>
      </TouchableOpacity>
      <Text>Result: {gatedResult || "(not read yet)"}</Text>
    </View>
  );
}
