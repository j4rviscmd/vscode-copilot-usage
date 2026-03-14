# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-03-14

### Added

- Add `copilotUsage.statusBarPriority` setting to configure the status bar display position (#17)

### Changed

- Reduce Copilot icon size in the status bar by adjusting SVG viewBox (#19)

## [0.2.0] - 2026-03-12

### Added

- Add `labelStyle` configuration setting to switch between icon and text display ("icon" or "text", default: "icon") (#13)
- Add custom GitHub Copilot icons with light/dark theme support (#13)
- Add `copilotUsage.toggleLabelStyle` command to quickly toggle label style (#13)
- Add `copilotUsage.setRefreshInterval` command to change refresh interval via command palette (#13)

## [0.1.1] - 2026-03-12

### Fixed

- Fix screenshot image path in README to use `./` prefix for VSCode Marketplace display (#7)

### Changed

- Update extension icon (icon.png) with new design (#9)

## [0.1.0] - 2025-03-10

### Added

- Initial release
- Display GitHub Copilot Premium Requests usage percentage in status bar
- Configurable refresh interval via `copilotUsage.refreshInterval` setting
- Automatic GitHub authentication using VSCode's built-in authentication
- Global state caching for multi-window support
