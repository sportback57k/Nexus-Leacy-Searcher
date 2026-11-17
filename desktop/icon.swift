import AppKit
import CoreImage
let source = CommandLine.arguments[1], destination = CommandLine.arguments[2]
let input = CIImage(data: try Data(contentsOf: URL(fileURLWithPath: source)))!
let mono = input.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 0])
let cg = CIContext(options: [.useSoftwareRenderer: true]).createCGImage(mono, from: mono.extent)!
let image = NSImage(cgImage: cg, size: NSSize(width: cg.width, height: cg.height))
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor.clear.setFill(); NSRect(x: 0, y: 0, width: 1024, height: 1024).fill()
let rect = NSRect(x: 64, y: 64, width: 896, height: 896)
let shape = NSBezierPath(roundedRect: rect, xRadius: 190, yRadius: 190)
NSColor(calibratedWhite: 0.025, alpha: 1).setFill(); shape.fill()
NSGraphicsContext.saveGraphicsState(); shape.addClip()
let height = 896 * image.size.height / image.size.width
image.draw(in: NSRect(x: 64, y: 64 + (896-height)/2, width: 896, height: height))
NSGraphicsContext.restoreGraphicsState()
NSColor(calibratedWhite: 0.35, alpha: 0.7).setStroke(); shape.lineWidth=1.5; shape.stroke()
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: destination))
