import {
    Extension,
    InjectionManager,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import {layoutManager} from 'resource:///org/gnome/shell/ui/main.js';
import {WindowPreview} from 'resource:///org/gnome/shell/ui/windowPreview.js';
import {WorkspaceAnimationController} from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';

import {disableEffect, enableEffect} from './manager/event_manager.js';
import {clearMutterSettingsCache} from './manager/utils.js';
import {addShadowInOverview} from './patch/add_shadow_in_overview.js';
import {
    addShadowsInWorkspaceSwitch,
    removeShadowsAfterWorkspaceSwitch,
} from './patch/workspace_switch.js';
import {logDebug} from './utils/log.js';
import {initPrefs, uninitPrefs} from './utils/settings.js';
import {WindowPicker} from './window_picker/service.js';

export default class RoundedWindowCornersReborn extends Extension {
    // The extension works by overriding (monkey patching) the code of GNOME
    // Shell's internal methods. InjectionManager is a convenience class that
    // stores references to the original methods and allows to easily restore
    // them when the extension is disabled.
    #injectionManager: InjectionManager | null = null;

    #windowPicker: WindowPicker | null = null;

    #layoutManagerStartupConnection: number | null = null;

    enable() {
        // Initialize extension preferences
        initPrefs(this.getSettings());

        this.#injectionManager = new InjectionManager();

        // Export the d-bus interface of the window picker in preferences.
        // See the readme in the `window_picker` directory for more information.
        this.#windowPicker = new WindowPicker();
        this.#windowPicker.export();

        if (layoutManager._startingUp) {
            // Wait for GNOME Shell to be ready before enabling rounded corners
            this.#layoutManagerStartupConnection = layoutManager.connect(
                'startup-complete',
                () => {
                    enableEffect();

                    layoutManager.disconnect(
                        // biome-ignore lint/style/noNonNullAssertion: Since this happens inside of the connection, there is no way for this to be null.
                        this.#layoutManagerStartupConnection!,
                    );
                },
            );
        } else {
            enableEffect();
        }

        // WindowPreview is a widget that shows a window in the overview.
        // We need to override its `_addWindow` method to add a shadow actor
        // to the preview, otherwise overview windows won't have custom
        // shadows.
        this.#injectionManager.overrideMethod(
            WindowPreview.prototype,
            '_addWindow',
            addWindow =>
                function (window) {
                    addWindow.call(this, window);
                    addShadowInOverview(window, this);
                },
        );

        // The same way we applied a cloned shadow actor to window previews in
        // the overview, we also need to apply it to windows during workspace
        // switching.
        this.#injectionManager.overrideMethod(
            WorkspaceAnimationController.prototype,
            '_prepareWorkspaceSwitch',
            prepareWorkspaceSwitch =>
                function (workspaceIndices) {
                    prepareWorkspaceSwitch.call(this, workspaceIndices);
                    addShadowsInWorkspaceSwitch(this);
                },
        );
        this.#injectionManager.overrideMethod(
            WorkspaceAnimationController.prototype,
            '_finishWorkspaceSwitch',
            finishWorkspaceSwitch =>
                function (switchData) {
                    removeShadowsAfterWorkspaceSwitch(this);
                    finishWorkspaceSwitch.call(this, switchData);
                },
        );

        logDebug('Enabled');
    }

    disable() {
        // Restore patched methods
        this.#injectionManager?.clear();
        this.#injectionManager = null;

        this.#windowPicker?.unexport();
        disableEffect();
        clearMutterSettingsCache();

        // Set all props to null
        this.#windowPicker = null;

        if (this.#layoutManagerStartupConnection !== null) {
            layoutManager.disconnect(this.#layoutManagerStartupConnection);
            this.#layoutManagerStartupConnection = null;
        }

        logDebug('Disabled');

        uninitPrefs();
    }
}
