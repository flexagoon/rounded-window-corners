import '@girs/gjs';
import '@girs/gjs/dom';
import '@girs/gnome-shell/ambient';
import '@girs/gnome-shell/extensions/global';
import '@girs/cogl-51';

declare module '@girs/gnome-shell/ui/layout' {
    import type {SignalCallback} from '@girs/gobject-2.0';

    export interface LayoutManager {
        connect<K extends keyof LayoutManager.SignalSignatures>(
            signal: K,
            callback: SignalCallback<
                LayoutManager,
                LayoutManager.SignalSignatures[K]
            >,
        ): number;
    }
}
