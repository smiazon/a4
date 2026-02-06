# Smiazon Browser

A clean, elegant web browser with classic book typography and a paper-like aesthetic. Built with Electron for full browser functionality.

## Features

- **Clean, Boxy Design**: Minimal, lightweight interface with sharp corners
- **Classic Typography**: Uses serif fonts (Crimson Text, Cormorant Garamond) for that classic book feel
- **Paper-like Aesthetic**: Subtle textures and warm colors reminiscent of old books
- **Full Browser Functionality**: 
  - Address bar with search
  - Navigation buttons (back, forward, refresh)
  - Tab management with drag & drop
  - Real web page rendering (no iframe restrictions!)
  - Chrome-like keyboard shortcuts

## Getting Started

### Installation

```bash
npm install
```

### Development

For web development (with iframe limitations):
```bash
npm run dev
```

For Electron development (full browser):
```bash
npm run electron:dev
```

This will start the Vite dev server and launch the Electron app.

### Build

Build for production:
```bash
npm run electron:build
```

This will create distributable packages for your platform (DMG on macOS, NSIS installer on Windows, AppImage on Linux).

## Keyboard Shortcuts

- `Ctrl+T` / `Cmd+T` - New tab
- `Ctrl+W` / `Cmd+W` - Close tab
- `Ctrl+Tab` / `Cmd+Tab` - Next tab
- `Ctrl+Shift+Tab` / `Cmd+Shift+Tab` - Previous tab
- `Ctrl+1-9` / `Cmd+1-9` - Switch to tab by number
- `Ctrl+L` / `Cmd+L` - Focus address bar
- `F5` / `Ctrl+R` / `Cmd+R` - Refresh

## Mouse Interactions

- Double-click tab bar - Create new tab
- Middle-click tab - Close tab
- Drag and drop - Reorder tabs
- Right-click tab - Close tab

## Technology Stack

- React 18
- Electron 28
- Vite
- Modern CSS with custom properties
- Classic serif fonts from Google Fonts

## Design Philosophy

Smiazon combines modern web browsing with the timeless elegance of classic typography. The interface features:

- **Boxy, minimal chrome**: Sharp corners, clean lines, maximum screen real estate
- **Serif typography**: Classic book fonts for a refined reading experience
- **Warm paper tones**: Beige and cream colors with subtle texture
- **Lightweight interactions**: Fast, simple transitions
