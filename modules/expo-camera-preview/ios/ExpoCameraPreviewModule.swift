import ExpoModulesCore

public class ExpoCameraPreviewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoCameraPreview")

    View(ExpoCameraPreviewView.self) {
    }
  }
}