//
//  BiometricAuthModule.swift
//  rninternals
//
//  Created by Hazo Baykulov on 08.07.2026.
//

import LocalAuthentication

@objc(BiometricAuthModule)
class BiometricAuthModule: NSObject {

  @objc
  func getBiometryType() -> String {
    let context = LAContext()
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
      return "none"
    }
    switch context.biometryType {
    case .faceID: return "faceID"
    case .touchID: return "touchID"
    default: return "none"
    }
  }

  @objc
  func authenticate(_ reason: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let context = LAContext()
    var error: NSError?

    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
      reject("BIOMETRY_UNAVAILABLE", error?.localizedDescription ?? "Biometry not available", error)
      return
    }

     context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, evalError in
      DispatchQueue.main.async {
        if success {
          resolve(true)
        } else {
          reject("AUTH_FAILED", evalError?.localizedDescription ?? "Authentication failed", evalError)
        }
      }
    }
  }
}
