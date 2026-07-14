import { requireNativeView } from "expo";
import { ViewProps } from "react-native";

const NativeView = requireNativeView("ExpoCameraPreview");

export default function ExpoCameraPreviewView(props: ViewProps) {
  return <NativeView {...props} />;
}
