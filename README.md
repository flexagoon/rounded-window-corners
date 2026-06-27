![Screenshot](https://github.com/user-attachments/assets/0bde1a86-37c8-4d53-b9ca-e049799f5355)

<div align="center">
  <h1>Rounded Window Corners Reborn</h1>
  <p><i>A GNOME extension that adds rounded corners to all windows</i></p>
  <a href="https://extensions.gnome.org/extension/7048/rounded-window-corners-reborn">
    <img src="https://img.shields.io/badge/Install%20from-extensions.gnome.org-4A86CF?style=for-the-badge&logo=Gnome&logoColor=white"/>
  </a>
</div>
<br>

> [!NOTE]
> This is the fork of the [original rounded-window-corners extension](https://github.com/yilozt/rounded-window-corners) by @yilozt, which is no longer maintained.

## Installation

### From Gnome Extensions

The extension is available on [extensions.gnome.org](https://extensions.gnome.org). You can install it directly [from here](https://extensions.gnome.org/extension/7048/rounded-window-corners-reborn/), or from the Extension Manager app.

### From pre-built archives

If you want to install the latest commit of the extension, you can get a
pre-built archive from GitHub Actions.

1. Sign in to GitHub.
2. Go to [the build action page](https://github.com/flexagoon/rounded-window-corners/actions/workflows/build.yml)
3. Click on the latest workflow run
4. Download the extension from the "artifacts" section at the bottom
5. Install it with the `gnome-extensions install` command

### From source code

1. Install the dependencies:
    - Node.js
    - npm
    - gettext
    - [just](https://just.systems)

    Those packages are available in the repositories of most linux distros, so
    you can simply install them with your package manager.

2. Build the extension

    ```bash
    git clone https://github.com/flexagoon/rounded-window-corners
    cd rounded-window-corners
    just install
    ```

After this, the extension will be installed to
`~/.local/share/gnome-shell/extensions`.

### From unofficial AUR packages on Arch Linux

If you use Arch, by the way, you can also install from the provided [AUR](https://aur.archlinux.org/) packages using [paru](https://github.com/Morganamilo/paru) or [yay](https://github.com/Jguer/yay). Two packages are available:

- [gnome-shell-extension-rounded-window-corners-reborn](https://aur.archlinux.org/packages/gnome-shell-extension-rounded-window-corners-reborn) uses the pre-build archives
- [gnome-shell-extension-rounded-window-corners-reborn-git](https://aur.archlinux.org/packages/gnome-shell-extension-rounded-window-corners-reborn-git) builds on your machine

Installation:

```zsh
paru gnome-shell-extension-rounded-window-corners-reborn
```

Note these packages are not official.

## Translation

You can help with the translation of the extension by submitting translations
on [Weblate](https://hosted.weblate.org/engage/rounded-window-corners-reborn)

[![Translation status](https://hosted.weblate.org/widget/rounded-window-corners-reborn/multi-auto.svg)](https://hosted.weblate.org/engage/rounded-window-corners-reborn/)

You can also manually edit .po files and submit a PR if you know how to do that.

## Development

Here are the avaliable `just` commands (run `just --list` to see this message):

```bash
Available recipes:
    build   # Compile the extension and all resources
    clean   # Delete the build directory
    install # Build and install the extension from source
    pack    # Build and pack the extension
    pot     # Update and compile the translation files
```

## Credits

Thanks to [yotamguttman](https://github.com/yotamguttman) for making an icon for the extension!
