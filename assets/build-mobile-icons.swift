import AppKit
import CoreImage

let sourcePath = CommandLine.arguments[1]
let outputDirectory = CommandLine.arguments[2]
let source = CIImage(data: try Data(contentsOf: URL(fileURLWithPath: sourcePath)))!
let monochrome = source.applyingFilter("CIColorControls", parameters: [
    kCIInputSaturationKey: 0.0,
    kCIInputContrastKey: 1.08
])
let cgImage = CIContext(options: [.useSoftwareRenderer: true]).createCGImage(monochrome, from: monochrome.extent)!
let logo = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))

for size in [180, 192, 512] {
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSColor(calibratedWhite: 0.018, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: size, height: size).fill()

    let inset = CGFloat(size) * 0.055
    let available = CGFloat(size) - inset * 2
    let logoHeight = available * logo.size.height / logo.size.width
    logo.draw(in: NSRect(
        x: inset,
        y: (CGFloat(size) - logoHeight) / 2,
        width: available,
        height: logoHeight
    ))

    NSGraphicsContext.current?.flushGraphics()
    let filename = size == 180 ? "nexus-touch-icon.png" : "nexus-pwa-\(size).png"
    let output = URL(fileURLWithPath: outputDirectory).appendingPathComponent(filename)
    try bitmap.representation(using: .png, properties: [:])!.write(to: output, options: .atomic)
    NSGraphicsContext.restoreGraphicsState()
}
