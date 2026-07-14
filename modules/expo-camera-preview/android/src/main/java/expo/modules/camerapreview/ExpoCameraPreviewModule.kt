package expo.modules.camerapreview

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoCameraPreviewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoCameraPreview")

    View(ExpoCameraPreviewView::class) {
    }
  }
}