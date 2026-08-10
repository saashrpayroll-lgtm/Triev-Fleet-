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
                description: 'Updating app automatically to latest build...',
                duration: 1500,
            });

            const timer = setTimeout(() => {
                updateServiceWorker(true);
            }, 1200);

            return () => clearTimeout(timer);
        }
    }, [needRefresh, updateServiceWorker]);

    // This component renders nothing — it's purely for side-effects
    return null;
};

export default ReloadPrompt;
