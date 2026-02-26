# Installation Instructions

## Prerequisites

1. **Steam Deck with SteamOS 3.0+** OR Linux PC with Steam
2. **Decky Loader installed** - See https://github.com/SteamDeckHomebrew/decky-loader

## Install Decky Loader (if not already installed)

On your Steam Deck:
1. Open the Steam Store
2. Go to Library → Software
3. Add this non-Steam game (as a URL):
   - `https://github.com/SteamDeckHomebrew/decky-loader/raw/main/dist/install_release.zip`
4. Run it once to install Decky Loader

## Install ROM Downloader Plugin

### Option 1: Direct copy (on Steam Deck)

```bash
# SSH into your Steam Deck or use Konsole
mkdir -p /home/deck/homebrew/plugins/rom-downloader

# Copy plugin files
cp plugin.json /home/deck/homebrew/plugins/rom-downloader/
cp dist/plugin.js /home/deck/homebrew/plugins/rom-downloader/
cp -r backend /home/deck/homebrew/plugins/rom-downloader/

# Restart Decky (or reboot)
```

### Option 2: SCP from your PC

```bash
# From your development machine
scp plugin.json deck@YOUR_STEAM_DECK_IP:/home/deck/homebrew/plugins/rom-downloader/
scp dist/plugin.js deck@YOUR_STEAM_DECK_IP:/home/deck/homebrew/plugins/rom-downloader/
scp -r backend deck@YOUR_STEAM_DECK_IP:/home/deck/homebrew/plugins/rom-downloader/
```

### Option 3: Use Decky's "Local Plugin" feature

1. In Decky settings, enable "Local Plugin Loading"
2. Copy the plugin folder to the configured location
3. Restart Decky

## Enable the Plugin

1. Open Decky Loader (three dots icon in Steam quick access menu)
2. Go to Settings → Plugins
3. Find "ROM Downloader" and enable it
4. The plugin will appear in the Decky menu

## Usage

1. Open Decky menu (three dots icon)
2. Click "ROM Downloader"
3. Select a console
4. Search for ROMs
5. Click download button

## Troubleshooting

- **Plugin not showing**: Check Decky logs in `/home/deck/homebrew/logs/`
- **Downloads failing**: Check download path permissions
- **Python errors**: Backend logs are in the same logs directory

## Uninstall

```bash
rm -rf /home/deck/homebrew/plugins/rom-downloader
# Then reload Decky
```
