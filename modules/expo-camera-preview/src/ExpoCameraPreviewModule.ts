import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoCameraPreviewModule extends NativeModule<{}> {}

export default requireNativeModule<ExpoCameraPreviewModule>('ExpoCameraPreview');
