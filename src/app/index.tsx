import { memo, useCallback, useRef, useState, type ComponentType } from "react";
import { FlatList, SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import GestureDemo from "./gesture-demo";
import DeviceInfoDemo from "@/components/demos/device-info-demo";
import BiometricAuthDemo from "@/components/demos/biometric-auth-demo";
import CameraPreviewDemo from "@/components/demos/camera-preview-demo";
import NotificationsDemo from "@/components/demos/notifications-demo";
import MmkvDemo from "@/components/demos/mmkv-demo";
import OfflineFirstDemo from "@/components/demos/offline-first-demo";
import SecureStoreDemo from "@/components/demos/secure-store-demo";
const ITEM_HEIGHT = 60;

type Item = { id: string; title: string; subtitle: string };

const DATA: Item[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `item-${i}`,
  title: `Item ${i}`,
  subtitle: `Subtitle for item ${i}`,
}));

const ListItem = memo(function ListItem({ item }: { item: Item }) {
  return (
    <View
      style={{
        height: ITEM_HEIGHT,
        justifyContent: "center",
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
      }}
    >
      <Text style={{ fontWeight: "bold" }}>{item.title}</Text>
      <Text style={{ color: "#6b7280", fontSize: 12 }}>{item.subtitle}</Text>
    </View>
  );
});

type Version =
  | "naive"
  | "optimized"
  | "gesture"
  | "deviceInfo"
  | "biometric"
  | "camera"
  | "notifications"
  | "mmkv"
  | "offlineFirst"
  | "secureStore";

const TABS: { key: Version; label: string }[] = [
  { key: "naive", label: "Naive" },
  { key: "optimized", label: "Optimized" },
  { key: "gesture", label: "Gesture" },
  { key: "deviceInfo", label: "Device Info" },
  { key: "biometric", label: "Biometric" },
  { key: "camera", label: "Camera" },
  { key: "notifications", label: "Push" },
  { key: "mmkv", label: "MMKV" },
  { key: "offlineFirst", label: "Offline First" },
  { key: "secureStore", label: "Secure Store" },
];

// Tabs that are just "render this self-contained demo component" — the
// Naive/Optimized FlatList variants are handled separately below since they
// share DATA/refs with this parent component rather than being standalone.
const SIMPLE_DEMOS: Partial<Record<Version, ComponentType>> = {
  gesture: GestureDemo,
  deviceInfo: DeviceInfoDemo,
  biometric: BiometricAuthDemo,
  camera: CameraPreviewDemo,
  notifications: NotificationsDemo,
  mmkv: MmkvDemo,
  offlineFirst: OfflineFirstDemo,
  secureStore: SecureStoreDemo,
};

export default function Index() {
  const [version, setVersion] = useState<Version>("naive");
  const naiveRef = useRef<FlatList>(null);
  const optimizedRef = useRef<FlatList>(null);

  const renderItem = useCallback(
    ({ item }: { item: Item }) => <ListItem item={item} />,
    [],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const SimpleDemo = SIMPLE_DEMOS[version];

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <TouchableOpacity
        style={{ margin: 12, padding: 10, backgroundColor: '#0ea5e9', borderRadius: 8 }}
        onPress={() => {
          naiveRef.current?.scrollToIndex({ index: 9999, animated: true });
          optimizedRef.current?.scrollToIndex({ index: 9999, animated: true });
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Jump to item 9999</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 }}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flexGrow: 1,
              padding: 10,
              backgroundColor: version === tab.key ? "#6366f1" : "#e5e7eb",
              borderRadius: 8,
            }}
            onPress={() => setVersion(tab.key)}
          >
            <Text
              style={{
                color: version === tab.key ? "white" : "black",
                textAlign: "center",
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {SimpleDemo ? (
        <SimpleDemo />
      ) : version === "naive" ? (
        <FlatList
          ref={naiveRef}
          data={DATA}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => <ListItem item={item} />}
          onScrollToIndexFailed={() => console.warn('naive: scrollToIndex failed — no getItemLayout')}
        />
      ) : (
        <FlatList
          ref={optimizedRef}
          data={DATA}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={15}
        />
      )}
    </SafeAreaView>
  );
}
