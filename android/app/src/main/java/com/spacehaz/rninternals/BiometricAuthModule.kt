package com.spacehaz.rninternals

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.spacehaz.rninternals.specs.NativeBiometricAuthSpec

class BiometricAuthModule(
  reactContext: ReactApplicationContext
) : NativeBiometricAuthSpec(reactContext) {

  override fun getBiometryType(): String {
    val biometricManager = BiometricManager.from(reactApplicationContext)
    return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
      BiometricManager.BIOMETRIC_SUCCESS -> "biometric"
      else -> "none"
    }
  }

  override fun authenticate(reason: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity as? FragmentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No active FragmentActivity to host the biometric prompt")
      return
    }

    val executor = ContextCompat.getMainExecutor(reactApplicationContext)

    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        promise.resolve(true)
      }

      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        promise.reject("AUTH_ERROR_$errorCode", errString.toString())
      }

      override fun onAuthenticationFailed() {
        // A single failed attempt — system prompt stays open for retry, so don't resolve/reject here.
      }
    }

    val biometricPrompt = BiometricPrompt(activity, executor, callback)

    val promptInfo = BiometricPrompt.PromptInfo.Builder()
      .setTitle(reason)
      .setNegativeButtonText("Cancel")
      .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
      .build()

    biometricPrompt.authenticate(promptInfo)
  }
}