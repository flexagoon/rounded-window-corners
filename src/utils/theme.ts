import Gio from "gi://Gio";

// Determine current theme variant (GNOME 42+ color-scheme or gtk-theme fallback)
export function currentThemeVariant(): 'dark' | 'light' {
    try {
        const settings = new Gio.Settings({schema: 'org.gnome.desktop.interface'});
        const colorScheme = settings.get_string('color-scheme');
        
        if (colorScheme === 'prefer-dark') {
            return 'dark';
        }

        const gtkTheme = settings.get_string('gtk-theme');
        
        if (gtkTheme && gtkTheme.toLowerCase().includes('dark')) {
            return 'dark';
        }
    } catch (e) {
        // ignore and fallback to light
    }

    return 'light';
}