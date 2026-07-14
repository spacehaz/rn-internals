package com.spacehaz.rninternals

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.spacehaz.rninternals.specs.NativeBiometricAuthSpec

class BiometricAuthPackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == NativeBiometricAuthSpec.NAME) {
      BiometricAuthModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        NativeBiometricAuthSpec.NAME to ReactModuleInfo(
          NativeBiometricAuthSpec.NAME,
          NativeBiometricAuthSpec.NAME,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true   // isTurboModule
        )
      )
    }
  }
}