import ExpoModulesCore
import AVFoundation

class ExpoCameraPreviewView: ExpoView {
  private let captureSession = AVCaptureSession()
  private lazy var previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)
    setupCaptureSession()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
  }

  private func setupCaptureSession() {
    AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
      guard granted, let self else { return }
      guard let device = AVCaptureDevice.default(for: .video),
            let input = try? AVCaptureDeviceInput(device: device) else { return }
      self.captureSession.beginConfiguration()
      if self.captureSession.canAddInput(input) {
        self.captureSession.addInput(input)
      }
      self.captureSession.commitConfiguration()
      self.captureSession.startRunning()
    }
  }

  deinit {
    captureSession.stopRunning()
  }
}