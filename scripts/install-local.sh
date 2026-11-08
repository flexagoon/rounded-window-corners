#!/usr/bin/env bash
# Installs the locally built extension over the SweetTooth version.
# Run from the repo root: ./scripts/install-local.sh
set -euo pipefail

UUID='rounded-window-corners@fxgn'
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)/_build"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

if [ ! -d "$BUILD_DIR" ]; then
  echo "error: $BUILD_DIR does not exist - run the build first" >&2
  exit 1
fi

# Compile the settings schemas shipped with the extension
glib-compile-schemas "$BUILD_DIR/schemas"

# Keep a backup of the currently installed version
if [ -d "$DEST" ]; then
  rm -rf "$DEST.bak"
  cp -r "$DEST" "$DEST.bak"
  echo "backed up the previous install to $DEST.bak"
fi

rm -rf "$DEST"
cp -r "$BUILD_DIR" "$DEST"
echo "installed $UUID from $BUILD_DIR"

echo
echo 'Next steps:'
echo '  1. Log out and back in (Wayland), or press Alt+F2, type r, Enter (X11).'
echo '  2. Make sure the extension is enabled:'
echo "     gnome-extensions enable $UUID"
echo '  3. Check for errors:'
echo "     journalctl -f -o cat /usr/bin/gnome-shell"
