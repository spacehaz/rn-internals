package com.spacehaz.rninternals

import android.content.Context
import android.os.BatteryManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.spacehaz.rninternals.specs.NativeCustomDeviceInfoSpec


class DeviceInfoModule(
  reactContext: ReactApplicationContext
) : NativeCustomDeviceInfoSpec(reactContext) {

  override fun getModel(): String = Build.MODEL
  override fun getSystemVersion(): String = Build.VERSION.RELEASE


  override fun getBatteryLevel(promise: Promise) {
    val batteryManager = reactApplicationContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    val level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    promise.resolve(level)
  }

  override fun getNativeStartTime(): Double = MainApplication.nativeStartTimeMs
}