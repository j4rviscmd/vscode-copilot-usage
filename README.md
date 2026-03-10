<div align="center">

# VSCode Copilot Usage

![statusbar screenshot](<assets/screenshots/statusbar.png>)

[![Latest Release](https://img.shields.io/github/v/release/j4rviscmd/vscode-copilot-usage?style=for-the-badge&color=green&label=Latest&logo=github&logoColor=white)](https://github.com/j4rviscmd/vscode-copilot-usage/releases/latest)
[![Last Commit](https://img.shields.io/github/last-commit/j4rviscmd/vscode-copilot-usage/main?style=for-the-badge&color=1F6FEB&label=Last%20Update&logo=git&logoColor=white)](https://github.com/j4rviscmd/vscode-copilot-usage/commits/main)
[![License](https://img.shields.io/badge/License-MIT-018FF5?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)

## A VSCode extension that displays GitHub Copilot Premium Requests usage in the status bar

</div>

## Features

- Displays Premium Requests usage percentage in the status bar (`Copilot: n%`)
- Configurable refresh interval
- Automatic GitHub authentication

## Installation

Install from VSCode Marketplace:

1. Open VSCode
2. Press `Cmd+Shift+X` (macOS) or `Ctrl+Shift+X` (Windows/Linux) to open Extensions
3. Search for "Copilot Usage"
4. Click Install

## Requirements

- VSCode 1.85.0 or higher
- GitHub account with Copilot subscription

## Configuration

|            Setting             |  Type  | Default |           Description            |
| ------------------------------ | ------ | ------- | -------------------------------- |
| `copilotUsage.refreshInterval` | number | 60      | Data refresh interval in seconds |

## Usage

After installation, the extension will:
1. Request GitHub authentication (if not already authenticated)
2. Fetch your Copilot usage data
3. Display the usage percentage in the status bar

### Status Bar Display

- `Copilot: n%` - Current usage percentage
- `Copilot: -` - Unable to fetch data (error or unlimited plan)

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch
```

## License

MIT
