import UIKit

@objc(DeviceInfoModule)
class DeviceInfoModule: NSObject {
  @objc
  func getModel() -> String {
      return UIDevice.current.model
  }

  @objc
  func getSystemVersion() -> String {
      return UIDevice.current.systemVersion
  }

  @objc
  func getBatteryLevel(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    UIDevice.current.isBatteryMonitoringEnabled = true
    let level = UIDevice.current.batteryLevel
    resolve(level * 100)
  }

  @objc
  func getNativeStartTime() -> NSNumber {
    return NSNumber(value: AppDelegate.nativeStartTimeMs)
  }
}