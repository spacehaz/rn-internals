package com.spacehaz.rninternals

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.spacehaz.rninternals.specs.NativeCustomDeviceInfoSpec


class DeviceInfoPackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == NativeCustomDeviceInfoSpec.NAME) {
        DeviceInfoModule(reactContext)
    } else {
        null
    }
  }



   override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
      return ReactModuleInfoProvider {
        mapOf(
          NativeCustomDeviceInfoSpec.NAME to ReactModuleInfo(
            NativeCustomDeviceInfoSpec.NAME,
            NativeCustomDeviceInfoSpec.NAME,
            false, // canOverrideExistingModule
            false, // needsEagerInit — the actual lazy-loading switch
            false, // isCxxModule
            true   // isTurboModule
          )
        )
      }
  }
}