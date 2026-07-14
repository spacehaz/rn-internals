package expo.modules.camerapreview

import android.content.Context
import android.content.pm.PackageManager
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.findViewTreeLifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class ExpoCameraPreviewView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val previewView = PreviewView(context)

  init {
    addView(previewView)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    startCamera()
  }

  private fun startCamera() {
    val hasPermission = ContextCompat.checkSelfPermission(
      context, android.Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED
    if (!hasPermission) return

    val lifecycleOwner = findViewTreeLifecycleOwner() ?: return
    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

    cameraProviderFuture.addListener({
      val cameraProvider = cameraProviderFuture.get()
      val preview = Preview.Builder().build().also {
        it.setSurfaceProvider(previewView.surfaceProvider)
      }

      cameraProvider.unbindAll()
      cameraProvider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview)
    }, ContextCompat.getMainExecutor(context))
  }
}