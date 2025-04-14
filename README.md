# Cursor Billing Stats Extension

This extension is a modified and updated version of the original [Cursor Stats](https://github.com/Dwtexe/cursor-stats) extension by Dwtexe. It has been forked, modified, and enhanced to provide improved billing and usage statistics for Cursor users.

## Modifications from Original

- Renamed to "Cursor Billing Stats" to avoid conflicts with the original extension
- Fixed display issues with undefined values in status bar
- Improved calculation of combined requests (base + usage-based)
- Enhanced tooltip formatting and information display
- Added better error handling and logging
- Optimized performance for faster updates

## Features

* 🚀 Real-time monitoring of Cursor usage
* 👥 Team usage tracking with per-user statistics
* 📊 Premium request tracking with detailed analytics
* 💰 Usage-based pricing information with billing cycle awareness
* 🔄 Smart cooldown and update mechanisms
* 🔔 Smart notification system with configurable thresholds
* 💸 Spending alerts with dollar amount thresholds
* 💳 Mid-month payment tracking and invoice notifications
* 🔒 Stripe integration for billing portal access
* 🖥️ Focus-aware updates with optimized performance
* 🎨 Customizable status bar display with optional colors
* 📝 Detailed tooltips with usage statistics
* ⚡ Command palette integration
* 🌙 Support for both regular and nightly Cursor versions

## Installation

### Manual Installation

1. Clone this repository or download the source code
2. Compile the extension using the following commands:
   ```
   npm install
   npm run compile
   vsce package
   ```
3. Open VS Code/Cursor
4. Press Ctrl+Shift+P (Cmd+Shift+P on macOS)
5. Type 'Install from VSIX' and select it
6. Choose the generated VSIX file (cursor-billing-stats-1.0.11.vsix)

## Configuration

The extension can be configured through VS Code settings:

* `cursorBillingStats.enableLogging`: Enable detailed logging for debugging
* `cursorBillingStats.enableStatusBarColors`: Toggle colored status bar based on usage
* `cursorBillingStats.enableAlerts`: Enable usage alert notifications
* `cursorBillingStats.usageAlertThresholds`: Configure percentage thresholds for alerts
* `cursorBillingStats.refreshInterval`: Set update frequency
* `cursorBillingStats.spendingAlertThreshold`: Configure dollar amount thresholds for spending alerts

## Building from Source

1. Clone the repository
   ```
   git clone https://github.com/comonetso/cursor-billing-stats.git
   cd cursor-billing-stats
   ```
2. Install dependencies
   ```
   npm install
   ```
3. Compile the TypeScript code
   ```
   npm run compile
   ```
4. Package the extension
   ```
   vsce package
   ```

## Credits

Original extension by [Dwtexe](https://github.com/Dwtexe/cursor-stats).
Modified and updated by [Blueming](https://github.com/comonetso).

## License

MIT