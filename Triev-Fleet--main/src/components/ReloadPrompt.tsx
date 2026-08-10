import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * ReloadPrompt — Handles PWA service worker updates.
 * 
 * When a new version of the app is deployed, this component detects the
 * waiting service worker and auto-reloads the page so users always run
 * the latest code without needing to manually refresh.
 */
const ReloadPrompt = () => {
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        // Check for SW updates every 25 seconds & on visibility change
        onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
            if (registration) {
                // Interval check
                setInterval(() => {
                    registration.update().catch(console.error);
                }, 25 * 1000);

                // Immediate check when app comes back to foreground on mobile PWA
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        registration.update().catch(console.error);
                    }
                });
            }
        },
        onRegisterError(error: Error) {
            console.error('SW registration error:', error);
        },
    });

    useEffect(() => {
        if (needRefresh) {
            toast.info('🚀 New Version Deployed!', {
                description: 'Purging cache & updating app automatically...',
                duration: 2000,
            });

            // Delete browser caches and reload immediately
            if ('caches' in window) {
                caches.keys().then((names) => {
                    names.forEach((name) => caches.delete(name));
                }).catch(console.error);
            }

            const timer = setTimeout(() => {
                updateServiceWorker(true);
                window.location.reload();
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [needRefresh, updateServiceWorker]);

    // Expose global manual update trigger for stuck mobile browsers
    useEffect(() => {
        (window as any).forceAppUpdate = async () => {
            toast.loading('Purging app cache and checking for updates...');
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
            }
            window.location.href = window.location.origin + '?v=' + Date.now();
        };
    }, []);
};

export default ReloadPrompt;
