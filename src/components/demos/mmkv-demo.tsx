import { useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";
import { storage } from "@/lib/storage";

export default function MmkvDemo() {
  // Reactive hook API — re-renders this component whenever the underlying
  // value changes, from anywhere (this component, another component, even a
  // different screen), since it's all backed by the same synchronous store.
  const [darkMode, setDarkMode] = useMMKVBoolean("darkMode", storage);
  const [username, setUsername] = useMMKVString("username", storage);

  // Raw imperative API — the same underlying primitive the hooks wrap.
  // No await: this returns synchronously, unlike AsyncStorage.
  const [rawReadResult, setRawReadResult] = useState<string>("");
  const writeRaw = useCallback(() => {
    storage.set("rawExample", Date.now().toString());
  }, []);
  const readRaw = useCallback(() => {
    setRawReadResult(storage.getString("rawExample") ?? "(not set yet)");
  }, []);

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text>Dark mode: {darkMode ? "on" : "off"}</Text>
        <TouchableOpacity
          style={{ padding: 8, backgroundColor: "#0ea5e9", borderRadius: 8 }}
          onPress={() => setDarkMode(!darkMode)}
        >
          <Text style={{ color: "white" }}>Toggle</Text>
        </TouchableOpacity>
      </View>

      <Text>Username: {username || "(not set)"}</Text>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#22c55e", borderRadius: 8 }}
        onPress={() => setUsername(`user-${Date.now() % 10000}`)}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Set random username</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#f97316", borderRadius: 8 }}
        onPress={writeRaw}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Write raw (storage.set)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#dc2626", borderRadius: 8 }}
        onPress={readRaw}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Read raw (storage.getString)</Text>
      </TouchableOpacity>
      <Text>Raw value: {rawReadResult || "(not read yet)"}</Text>

      <Text style={{ marginTop: 8, color: "#6b7280" }}>
        Kill and reopen the app — darkMode/username should still be set. That's the persistence
        proof; everything above this line survives app restarts, unlike component state.
      </Text>
    </View>
  );
}
