# Expand path patterns like **/*.ui
set shell := ['bash', '-O', 'globstar', '-c']

buildDir := './_build'
uuid := 'rounded-window-corners@fxgn'

# Compile the extension and all resources
build: clean && pot
  # Compile TypeScript
  npm install
  npx tsc --outDir {{buildDir}}

  # Copy non-JS files
  cp -r ./resources/* {{buildDir}}
  for file in $(find src -type f ! -name "*.ts" -printf '%P\n'); do \
    path={{buildDir}}/$(dirname $file); \
    mkdir -p $path; \
    cp src/$file $path; \
  done;

# Build and install the extension from source
install: build
  glib-compile-schemas {{buildDir}}/schemas
  rm -rf ~/.local/share/gnome-shell/extensions/{{uuid}}
  cp -r {{buildDir}} ~/.local/share/gnome-shell/extensions/{{uuid}}

# Build and pack the extension
pack: build
  cd {{buildDir}} && zip -9r ../{{uuid}}.shell-extension.zip .

# Delete the build directory
clean:
  rm -rf {{buildDir}} {{uuid}}.shell-extension.zip
  
# Update and compile the translation files
pot:
  xgettext --from-code=UTF-8 \
           --output=po/{{uuid}}.pot \
           src/**/*.ui

  xgettext --from-code=UTF-8 \
           --output=po/{{uuid}}.pot \
           --language=JavaScript \
           --join-existing \
           src/**/*.ts

  for file in po/*.po; do \
    msgmerge -q -U --backup=off $file po/{{uuid}}.pot; \
  done;

  for file in po/*.po; do \
    locale=$(basename $file .po); \
    dir="{{buildDir}}/locale/$locale/LC_MESSAGES"; \
    mkdir -p $dir; \
    msgfmt -o $dir/{{uuid}}.mo $file; \
  done;
