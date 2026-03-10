# VSCode Copilot Usage

A VSCode extension that displays GitHub Copilot Premium Requests usage in the status bar.

## Features

- Displays Premium Requests usage percentage in the status bar (`Copilot: n%`)
- Configurable refresh interval
- Automatic GitHub authentication

## Requirements

- VSCode 1.85.0 or higher
- GitHub account with Copilot subscription

## Installation

1. Open VSCode
2. Press `F5` to launch Extension Development Host
3. The extension will activate automatically

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
