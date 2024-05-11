![2022-07-29 23-49-57][6]

<div align="center">
  <h1>Rounded Window Corners Reborn</h1>
  <p><i>A GNOME extension that adds rounded corners to all windows</i></p>
  <!--<a href="https://extensions.gnome.org/extension/5237/rounded-window-corners/">-->
  <!--  <img src="https://img.shields.io/badge/Install%20from-extensions.gnome.org-4A86CF?style=for-the-badge&logo=Gnome&logoColor=white"/>-->
  <!--</a>  -->
</div>

This is the fork of the [original rounded-window-corners extension][14] by
@yilozt, which is no longer maintained.

## Features

- Works with Gnome 45+
- Custom border radius and clip paddings for windows
- Blocklist for applications that draw their own window decorations
- Custom shadow for windows with rounded corners
- Option to skip libadwaita / libhandy application
- [Superelliptical][1] shape for rounded corners, thanks to [@YuraIz][2]
- A simple reset preferences dialog

## Compatibility

- [_Compiz alike magic lamp effect_][3]

    This extension automatically hides the shadow when the magic lamp effect is
    running. You need to restart (disable then enable) this extension after
    enabling _Compiz alike magic lamp effect_. 

## Notes

- The rounded corner effect for windows is based on this [shader][4] from
  mutter project
- TypeScript support for GJS is powered by [gjsify](https://gjsify.org/)

## Installation

### From pre-built archives

If you want to install the latest commit of the extension, you can get a
pre-built archive from GitHub Actions.

1. Go to [the build action page](https://github.com/flexagoon/rounded-window-corners/actions/workflows/build.yml)
2. Click on the latest workflow run
3. Download the extension from the "artifacts" section at the bottom
4. Install it with the `gnome-extensions install` command

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

<!-- links -->

[1]: https://en.wikipedia.org/wiki/Superellipse
[2]: https://github.com/YuraIz
[3]: https://extensions.gnome.org/extension/3740/compiz-alike-magic-lamp-effect/
[4]: https://gitlab.gnome.org/GNOME/mutter/-/blob/main/src/compositor/meta-background-content.c#L138
[6]: https://user-images.githubusercontent.com/32430186/181902857-d4d10740-82fe-4941-b064-d436b9ea7317.png
[7]: https://extensions.gnome.org/extension/5237/rounded-window-corners/
[8]: https://github.com/yilozt/rounded-window-corners/releases
[9]: https://github.com/yilozt/rounded-window-corners/actions/workflows/pack.yml
[10]: https://img.shields.io/github/v/release/yilozt/rounded-window-corners?style=flat-square
[11]: https://img.shields.io/github/actions/workflow/status/yilozt/rounded-window-corners/pack.yml?branch=main&style=flat-square
[12]: https://hosted.weblate.org/widgets/rounded-window-corners/-/rounded-window-corners/multi-auto.svg
[13]: https://hosted.weblate.org/engage/rounded-window-corners/
[14]: https://github.com/yilozt/rounded-window-corners
