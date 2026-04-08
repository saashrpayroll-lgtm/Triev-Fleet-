import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

const InstallPWA = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            const promptEvent = e as BeforeInstallPromptEvent;
            // Prevent the mini-infobar from appearing on mobile
            promptEvent.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(promptEvent);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            toast.success('Thank you for installing the app!');
        } else {
            console.log('User dismissed the install prompt');
        }

        // We've used the prompt, so it can't be used again, discard it
        setDeferredPrompt(null);
        setIsInstallable(false);
    };

    if (!isInstallable) return null;

    return (
        <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-lg animate-in fade-in"
        >
            <Download size={18} />
            <span className="font-semibold text-sm">Install App</span>
        </button>
    );
};

export default InstallPWA;
