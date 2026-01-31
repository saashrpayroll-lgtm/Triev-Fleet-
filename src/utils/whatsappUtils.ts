import { Rider } from '@/types';

/**
 * Generate AI-powered WhatsApp payment reminder message
 * Supports both English and Hindi languages
 */
export const generateWhatsAppReminder = (
    rider: Rider,
    language: 'english' | 'hindi' = 'english'
): string => {
    const amount = Math.abs(rider.walletAmount);
    const formattedAmount = `₹${amount.toFixed(2)}`;

    const templates = {
        english: `🔔 Payment Reminder

Dear ${rider.riderName},

Your wallet balance is currently ₹${rider.walletAmount.toFixed(2)}.

⚠️ Outstanding Amount: ${formattedAmount}

Please clear this amount at the earliest to continue your services smoothly.

📞 Contact your Team Leader ${rider.teamLeaderName} for any queries.

Thank you,
Triev Rider Pro`,

        hindi: `🔔 भुगतान अनुस्मारक

प्रिय ${rider.riderName},

आपका वॉलेट बैलेंस वर्तमान में ₹${rider.walletAmount.toFixed(2)} है।

⚠️ बकाया राशि: ${formattedAmount}

कृपया अपनी सेवाओं को सुचारू रूप से जारी रखने के लिए इस राशि का जल्द से जल्द भुगतान करें।

📞 किसी भी प्रश्न के लिए अपने टीम लीडर ${rider.teamLeaderName} से संपर्क करें।

धन्यवाद,
Triev Rider Pro`
    };

    return templates[language];
};

/**
 * Send WhatsApp message using WhatsApp Web API
 */
export const sendWhatsAppMessage = (phoneNumber: string, message: string) => {
    // Remove +91 and any spaces/dashes
    const cleanNumber = phoneNumber.replace(/[+\s-]/g, '');

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    // Open WhatsApp Web with pre-filled message
    const whatsappURL = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    window.open(whatsappURL, '_blank');
};

/**
 * Check if rider has negative wallet balance
 */
export const hasNegativeWallet = (rider: Rider): boolean => {
    return rider.walletAmount < 0;
};

/**
 * Get all riders with negative wallets from a list
 */
export const getRidersWithNegativeWallets = (riders: Rider[]): Rider[] => {
    return riders.filter(hasNegativeWallet);
};

/**
 * Format phone number for WhatsApp
 */
export const formatPhoneForWhatsApp = (phoneNumber: string): string => {
    // Ensure it starts with country code
    if (phoneNumber.startsWith('+')) {
        return phoneNumber;
    }
    if (phoneNumber.startsWith('91')) {
        return `+${phoneNumber}`;
    }
    return `+91${phoneNumber}`;
};

/**
 * Send bulk WhatsApp reminders to multiple riders
 */
export const sendBulkWhatsAppReminders = (
    riders: Rider[],
    language: 'english' | 'hindi' = 'english',
    delay: number = 2000
) => {
    riders.forEach((rider, index) => {
        setTimeout(() => {
            const message = generateWhatsAppReminder(rider, language);
            sendWhatsAppMessage(rider.mobileNumber, message);
        }, index * delay); // Stagger messages to avoid rate limiting
    });
};
