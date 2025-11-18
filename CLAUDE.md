# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SiYuan plugin template built with Vite and Svelte 4. It provides a modern development workflow for creating SiYuan plugins with hot-reload support during development.

## Development Commands

### Setup
```bash
pnpm i                  # Install dependencies
pnpm run make-link      # Create symbolic link to SiYuan plugins directory
```

**Note on make-link**: On Windows, creating directory symbolic links requires administrator privileges. Options:
- Run command with admin privileges
- Enable Windows Developer Mode
- Use `pnpm run make-link-win` (requires PowerShell script execution permissions)

### Development Workflow
```bash
pnpm run dev            # Start development mode with watch and hot-reload
pnpm run build          # Build production package (creates package.zip)
pnpm run update-version # Update version number across files
pnpm run make-install   # Build and install to SiYuan plugins directory
```

## Architecture

### Plugin Entry Point
- **src/index.ts**: Main plugin class (`PluginSample`) extending SiYuan's `Plugin` base class
  - Lifecycle hooks: `onload()`, `onLayoutReady()`, `onunload()`, `uninstall()`
  - Defines custom tabs, docks, commands, menus, and event bus handlers

### Key Components

**API Layer** (`src/api.ts`):
- Wrapper functions for SiYuan kernel HTTP API
- Categories: Notebook, File Tree, Asset Files, Blocks, Attributes, SQL, Templates, Files, Export, Conversion, Notifications, Network, System
- All API calls use `fetchPost` or `fetchSyncPost` from the SiYuan SDK

**Settings System** (`src/libs/setting-utils.ts`):
- `SettingUtils` class provides declarative settings UI
- Supports input types: textinput, textarea, checkbox, select, slider, number, button, hint, custom
- Handles automatic persistence to plugin storage
- Methods: `get()`, `set()`, `setAndSave()`, `take()`, `takeAndSave()`, `load()`, `save()`

**UI Components** (`src/libs/components/`):
- Svelte components for reusable UI elements
- Form components with SiYuan's B3 design system integration

**Dialogs** (`src/libs/dialog.ts`):
- `svelteDialog()` helper for creating dialogs with Svelte components

### Build System (vite.config.ts)

**Custom Plugins**:
1. **vitePluginYamlI18n**: Converts YAML i18n files to JSON during build
2. **cleanupDistFiles**: Removes unnecessary files from dist after build
3. **vite-plugin-zip-pack**: Creates package.zip for marketplace distribution

**Build Modes**:
- Development (`NODE_ENV=development`): Outputs to `dev/`, enables live reload, watches external files
- Production (`NODE_ENV=production`): Outputs to `dist/`, minifies, creates package.zip

**Path Aliases**:
- `@/*` → `src/*`
- `@/libs/*` → `src/libs/*`

### Internationalization

I18n files support both JSON and YAML formats:
- Source: `public/i18n/*.json` or `public/i18n/*.yaml`
- Build output: `dev/i18n/*.json` or `dist/i18n/*.json`
- Access in code: `this.i18n.key`

Multi-language support for:
- Plugin metadata (`plugin.json`: displayName, description, readme)
- UI strings (i18n files)

### Plugin Configuration (plugin.json)

Required fields:
- `name`: Must match repository name (globally unique)
- `version`: Follow semver specification
- `minAppVersion`: Minimum SiYuan version required
- `backends`: Supported platforms (windows, linux, darwin, docker, android, ios, harmony)
- `frontends`: Supported interfaces (desktop, mobile, browser-desktop, browser-mobile, desktop-window)
- `displayName`, `description`, `readme`: Multilingual objects
- `disabledInPublish`: Set to `true` for template/sample plugins

### Development Best Practices

**File Operations**:
- Always use SiYuan kernel APIs (`/api/file/*`) for file operations in the `data` directory
- Never use Node.js `fs` or Electron APIs directly to avoid data corruption during sync

**Daily Notes**:
- If creating daily notes manually (not via `/api/filetree/createDailyNote`), add the `custom-dailynote-yyyymmdd` attribute to distinguish from regular documents

**Package Requirements**:
Final package.zip must contain:
- `i18n/*`
- `icon.png` (160×160)
- `index.css`
- `index.js`
- `plugin.json`
- `preview.png` (1024×768)
- `README*.md`

## Release Process

1. Update version: `pnpm run update-version`
2. Build package: `pnpm run build` (creates package.zip)
3. Create GitHub release with tag `v*` (e.g., `v0.4.1`)
4. Upload package.zip as release asset
5. First release only: PR to [Community Bazaar](https://github.com/siyuan-note/bazaar) to add repo to `plugins.json`

**GitHub Actions**: Pushing a `v*` tag automatically builds and creates a pre-release with package.zip.

## TypeScript Configuration

- Target: ESNext
- Module: ESNext with Node resolution
- Strict mode: Disabled (for flexibility)
- Unused locals/parameters: Enabled
- Path aliases configured for `@/*` imports
- Svelte type checking enabled (`checkJs: true`)

## Development Lessons Learned

**Avoiding Infinite Loops with Third-Party Libraries**: When integrating libraries like flatpickr with Svelte, avoid using reactive statements (`$:`) to directly update the library instance, as this can cause infinite loops that freeze the application. Instead, use `afterUpdate()` lifecycle hook with change detection by tracking previous values. Always compare current and previous values before updating, and use library API parameters (e.g., `setDate(dates, false)`) to prevent triggering callbacks that would re-trigger Svelte's reactive system.
