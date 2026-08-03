//
//  DonelyAppColors.swift
//  Donely
//
//  Single source of truth for the native chrome color. Must stay in sync with
//  the web app's --background token (see src/styles.css) and the
//  backgroundColor values in capacitor.config.ts.
//

import UIKit

enum DonelyAppColors {
    /// Light: #afa9a6 (warm taupe)  Dark: #0e1217
    static let background: UIColor = {
        let light = UIColor(red: 0.686, green: 0.663, blue: 0.651, alpha: 1)
        let dark = UIColor(red: 0.055, green: 0.071, blue: 0.090, alpha: 1)
        return UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        }
    }()
}
