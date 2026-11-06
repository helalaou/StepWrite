import Photos
import UIKit

/// The newest screenshot in Photos: in a chat, press the side and volume-up
/// buttons, then tap Screenshot on the keyboard, and StepWrite replies to what
/// is on screen.
enum ScreenshotLibrary {
    enum LibraryError: LocalizedError {
        case denied
        case none

        var errorDescription: String? {
            switch self {
            case .denied:
                return "\(Brand.name) can't see your screenshots. Allow access to Photos in Settings, then try again."
            case .none:
                return "There's no screenshot yet. Take one of the chat, then try again."
            }
        }
    }

    static func latestScreenshot() async throws -> UIImage {
        let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        guard status == .authorized || status == .limited else { throw LibraryError.denied }

        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.fetchLimit = 1
        options.predicate = NSPredicate(format: "(mediaSubtypes & %d) != 0", PHAssetMediaSubtype.photoScreenshot.rawValue)
        // Pictures added some other way, as in the simulator, aren't marked as
        // screenshots; the newest picture is the next best guess.
        let asset = PHAsset.fetchAssets(with: .image, options: options).firstObject
            ?? newestImage()
        guard let asset else { throw LibraryError.none }

        let request = PHImageRequestOptions()
        request.deliveryMode = .highQualityFormat
        request.isNetworkAccessAllowed = true
        request.isSynchronous = false
        return try await withCheckedThrowingContinuation { continuation in
            PHImageManager.default().requestImageDataAndOrientation(for: asset, options: request) { data, _, _, _ in
                if let data, let image = UIImage(data: data) {
                    continuation.resume(returning: image)
                } else {
                    continuation.resume(throwing: LibraryError.none)
                }
            }
        }
    }

    private static func newestImage() -> PHAsset? {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.fetchLimit = 1
        return PHAsset.fetchAssets(with: .image, options: options).firstObject
    }
}
