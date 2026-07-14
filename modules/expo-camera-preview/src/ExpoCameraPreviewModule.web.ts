import { registerWebModule, NativeModule } from 'expo';

class ExpoCameraPreviewModule extends NativeModule<{}> {}

export default registerWebModule(ExpoCameraPreviewModule, 'ExpoCameraPreviewModule');
