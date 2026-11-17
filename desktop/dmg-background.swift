import AppKit
import CoreGraphics

let destination = CommandLine.arguments[1]
let width = 900
let height = 620
let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
    isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0,
    bitsPerPixel: 0
)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSGraphicsContext.current?.imageInterpolation = .high

let rect = NSRect(x: 0, y: 0, width: width, height: height)
let bg = NSGradient(colors: [NSColor(calibratedWhite: 0.035, alpha: 1), NSColor(calibratedWhite: 0.105, alpha: 1)])!
bg.draw(in: rect, angle: 90)

// Subtle technical grid and corner marks, kept behind the install instructions.
NSColor(calibratedWhite: 1, alpha: 0.035).setStroke()
let grid = NSBezierPath()
grid.lineWidth = 0.5
stride(from: 24, to: width, by: 30).forEach { x in
    grid.move(to: NSPoint(x: x, y: 0)); grid.line(to: NSPoint(x: x, y: height))
}
stride(from: 20, to: height, by: 30).forEach { y in
    grid.move(to: NSPoint(x: 0, y: y)); grid.line(to: NSPoint(x: width, y: y))
}
grid.stroke()

let frame = NSBezierPath(roundedRect: NSRect(x: 26, y: 25, width: width - 52, height: height - 50), xRadius: 20, yRadius: 20)
NSColor(calibratedWhite: 1, alpha: 0.14).setStroke()
frame.lineWidth = 1
frame.stroke()

func text(_ value: String, x: CGFloat, y: CGFloat, size: CGFloat, weight: NSFont.Weight, color: NSColor, tracking: CGFloat = 0) {
    let font = NSFont.systemFont(ofSize: size, weight: weight)
    let para = NSMutableParagraphStyle()
    para.lineBreakMode = .byClipping
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font, .foregroundColor: color, .paragraphStyle: para,
        .kern: tracking
    ]
    (value as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: attrs)
}

text("NEXUS", x: 60, y: 506, size: 14, weight: .semibold,
     color: NSColor(calibratedWhite: 0.68, alpha: 1), tracking: 4)
text("LEGACY", x: 59, y: 452, size: 44, weight: .bold,
     color: NSColor(calibratedWhite: 1, alpha: 1), tracking: 6)
text("VOTRE ESPACE, EN VERSION DESKTOP.", x: 62, y: 422, size: 12, weight: .medium,
     color: NSColor(calibratedWhite: 0.72, alpha: 1), tracking: 1.8)

let divider = NSBezierPath()
divider.move(to: NSPoint(x: 62, y: 398)); divider.line(to: NSPoint(x: 838, y: 398))
NSColor(calibratedWhite: 1, alpha: 0.18).setStroke(); divider.lineWidth = 1; divider.stroke()

text("GLISSEZ L’APP VERS APPLICATIONS", x: 247, y: 340, size: 12, weight: .semibold,
     color: NSColor(calibratedWhite: 0.77, alpha: 1), tracking: 1.3)

// A fine directional line indicates the familiar Mac drag-to-install action.
let arrow = NSBezierPath()
arrow.move(to: NSPoint(x: 365, y: 260)); arrow.line(to: NSPoint(x: 532, y: 260))
arrow.move(to: NSPoint(x: 519, y: 270)); arrow.line(to: NSPoint(x: 532, y: 260)); arrow.line(to: NSPoint(x: 519, y: 250))
NSColor(calibratedWhite: 1, alpha: 0.82).setStroke(); arrow.lineWidth = 1.4; arrow.lineCapStyle = .round; arrow.stroke()

text("MAC INTEL  ·  macOS 12+", x: 342, y: 73, size: 10, weight: .medium,
     color: NSColor(calibratedWhite: 0.55, alpha: 1), tracking: 1.2)

NSGraphicsContext.current?.flushGraphics()
let png = rep.representation(using: .png, properties: [:])!
try png.write(to: URL(fileURLWithPath: destination), options: .atomic)
NSGraphicsContext.restoreGraphicsState()
