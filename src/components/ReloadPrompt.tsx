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
        // Check for SW updates every 60 seconds
        onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
            if (registration) {
                setInterval(() => {
                    registration.update();
                }, 60 * 1000);
            }
        },
        onRegisterError(error: Error) {
            console.error('SW registration error:', error);
        },
    });

    useEffect(() => {
        if (needRefresh) {
            toast.info('A new version is available!', {
                description: 'Updating automatically...',
                duration: 2000,
            });

            // Auto-reload after a short delay so the toast is visible
            const timer = setTimeout(() => {
                updateServiceWorker(true);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [needRefresh, updateServiceWorker]);

    // This component renders nothing — it's purely for side-effects
    return null;
};

export default ReloadPrompt;
