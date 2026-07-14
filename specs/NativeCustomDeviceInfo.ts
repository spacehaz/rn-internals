import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

export interface Spec extends TurboModule {
  getModel(): string
  getSystemVersion(): string
  getBatteryLevel(): Promise<number>
  getNativeStartTime(): number
}

export default TurboModuleRegistry.getEnforcing<Spec>('CustomDeviceInfo')