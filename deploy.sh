#!/bin/bash
# Build and package ROM Downloader plugin for Decky Loader

set -e

# Get version from package.json
VERSION=$(grep '"version"' package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[", ]//g')
PLUGIN_NAME="rom-downloader"
ZIP_NAME="${PLUGIN_NAME}-v${VERSION}.zip"
BUILD_DIR="build/${PLUGIN_NAME}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "npm not found. Installing Node.js/npm..."
  sudo pacman -S nodejs npm --needed --noconfirm
fi

echo "Pulling latest code..."
git pull 2>/dev/null || echo "No git updates or not a git repo"

echo "Installing dependencies..."
npm install

echo "Building plugin..."
npm run build

echo "Creating package structure..."
rm -rf build
mkdir -p "$BUILD_DIR/dist"

echo "Copying files to package..."
cp dist/index.js "$BUILD_DIR/dist/index.js"
cp plugin.json "$BUILD_DIR/"
cp package.json "$BUILD_DIR/"
cp README.md "$BUILD_DIR/" 2>/dev/null || true
cp LICENSE "$BUILD_DIR/" 2>/dev/null || true
cp main.py "$BUILD_DIR/"

# Copy defaults if exists
if [ -d "defaults" ]; then
  cp -r defaults "$BUILD_DIR/"
fi

echo "Creating ZIP package..."
cd build
zip -r "../$ZIP_NAME" "$PLUGIN_NAME"
cd ..

echo "Cleaning up build directory..."
rm -rf build

echo "Package created: $ZIP_NAME"
