import { browser } from '$app/environment';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export class App {
    /** User's selected theme preference */
    themeMode = $state<ThemeMode>('system');
    /** The actual theme being displayed (resolved from themeMode + system preference) */
    theme = $state<ResolvedTheme>('dark');
    now = $state(new Date());
    private timeInterval?: ReturnType<typeof setInterval>;
    private mediaQuery?: MediaQueryList;

    constructor() {
        // Only initialize theme on the client side
        if (browser) {
            this.initializeTheme();
            this.startTimeClock();
        }
    }

    private startTimeClock() {
        // Update immediately
        this.now = new Date();

        // Update every 950ms
        this.timeInterval = setInterval(() => {
            this.now = new Date();
        }, 950);
    }

    destroy() {
        if (this.timeInterval) {
            clearInterval(this.timeInterval);
        }
        // Clean up media query listener
        if (this.mediaQuery) {
            this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
        }
    }

    private handleSystemThemeChange = (e: MediaQueryListEvent) => {
        // Only update if in system mode
        if (this.themeMode === 'system') {
            this.theme = e.matches ? 'dark' : 'light';
        }
    };

    private getSystemTheme(): ResolvedTheme {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    private resolveTheme(mode: ThemeMode): ResolvedTheme {
        if (mode === 'system') {
            return this.getSystemTheme();
        }
        return mode;
    }

    private initializeTheme() {
        // Set up system theme listener
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);

        // Check localStorage for saved theme mode
        const savedMode = localStorage.getItem('theme') as ThemeMode | null;
        if (savedMode === 'system' || savedMode === 'light' || savedMode === 'dark') {
            this.themeMode = savedMode;
            this.theme = this.resolveTheme(savedMode);
            return;
        }

        // Default to dark for first-time users
        this.themeMode = 'dark';
        this.theme = 'dark';
    }

    setThemeMode(mode: ThemeMode) {
        this.themeMode = mode;
        this.theme = this.resolveTheme(mode);
        if (browser) {
            localStorage.setItem('theme', mode);
        }
    }

    toggleTheme() {
        // Cycle through: system -> light -> dark -> system
        const modes: ThemeMode[] = ['system', 'light', 'dark'];
        const currentIndex = modes.indexOf(this.themeMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        this.setThemeMode(nextMode);
    }
}

// Export singleton instance
export const app = new App();