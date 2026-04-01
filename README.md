# Rounded Window Corners Reborn — GNOME 49 crash fix

Fork di [flexagoon/rounded-window-corners](https://github.com/flexagoon/rounded-window-corners) con fix per un crash critico su GNOME 49.

## Il problema

Su GNOME Shell 49.x, cliccare sull'icona di un'app già aperta in background (es. Telegram, Materialgram) causava il crash immediato della sessione GNOME con `SIGABRT`.

Il crash avveniva in `libmutter-clutter` durante il paint dell'effetto rounded corners, quando una finestra si trovava in una **transizione di stato** (maximize/restore/raise) con dimensioni temporaneamente pari a zero.

Stack trace del crash:
```
g_assertion_message_expr (libglib-2.0.so.0)
  → libmutter-clutter-17.so.0 (clutter_actor_continue_paint)
  → clutter_paint_node_paint
  → clutter_actor_paint
  → meta_window_actor_paint_to_content (libmutter-17.so.0)
  → GJS / JavaScript callback
```

## Fix applicati

### 1. `effect/rounded_corners_effect.js` — crash principale

**Problema**: `vfunc_paint_target` veniva chiamato con l'attore a dimensioni 0x0, causando un'assertion failure in Clutter (`width > 0 && height > 0`). Inoltre `updateUniforms` calcolava `1 / width` e `1 / height` con divisione per zero, e usava `bounds[4]` (fuori bounds, sempre `undefined`).

**Fix**:
- Aggiunto override di `vfunc_paint_target` con guardia sulle dimensioni
- Aggiunta guardia in `updateUniforms` sulle dimensioni prima di procedere
- Corretta divisione per zero in `pixelStep`
- Corretto indice `bounds[4]` → `bounds[3]` nel calcolo di `maxRadius`

### 2. `manager/utils.js` — null safety

**Problema**: `unwrapActor()` e `getRoundedCornersEffect()` accedevano a `actor.metaWindow.get_client_type()` senza verificare che `metaWindow` non fosse `null`, causando errori JS visibili nei log.

**Fix**: Aggiunto controllo `if (!actor?.metaWindow) return null` in entrambe le funzioni.

### 3. `manager/event_handlers.js` — null safety

**Problema**: `onAddEffect()`, `refreshShadow()` e `refreshRoundedCorners()` usavano `actor.metaWindow` senza null check, portando a `TypeError: can't access property "get_client_type", win is null` nei log di GNOME Shell.

**Fix**: Aggiunto `if (!win) return` all'inizio di ciascuna funzione dopo aver letto `actor?.metaWindow`.

## Versioni interessate

- GNOME Shell **49.x** (confermato su 49.5)
- Estensione versione **14** (`rounded-window-corners@fxgn`)
- Distribuzione testata: **CachyOS** (Arch-based)

## Installazione manuale

```bash
# Backup dell'estensione originale
cp -r ~/.local/share/gnome-shell/extensions/rounded-window-corners@fxgn \
      ~/.local/share/gnome-shell/extensions/rounded-window-corners@fxgn.bak

# Clona questo fork
git clone https://github.com/TUO_USERNAME/rounded-window-corners.git
cd rounded-window-corners

# Copia i file patchati
cp effect/rounded_corners_effect.js \
   manager/utils.js \
   manager/event_handlers.js \
   ~/.local/share/gnome-shell/extensions/rounded-window-corners@fxgn/effect/
cp manager/utils.js manager/event_handlers.js \
   ~/.local/share/gnome-shell/extensions/rounded-window-corners@fxgn/manager/

# Ricarica l'estensione
gnome-extensions disable rounded-window-corners@fxgn
gnome-extensions enable rounded-window-corners@fxgn
```

## Upstream

Il fix è stato sviluppato analizzando i coredump prodotti dal crash. Si raccomanda di aprire una PR sul repository originale:
[https://github.com/flexagoon/rounded-window-corners](https://github.com/flexagoon/rounded-window-corners)
