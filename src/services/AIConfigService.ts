export const AI_CONFIG_KEY = 'TRIEV_AI_CONFIG';

export interface AIConfig {
    geminiKey: string;
    openAIKey: string;
    groqKey: string;
    activeProvider: 'gemini' | 'openai' | 'groq';
}

export const AIConfigService = {
    getConfig: (): AIConfig => {
        const localConfig = localStorage.getItem(AI_CONFIG_KEY);
        if (localConfig) {
            return JSON.parse(localConfig);
        }
        return {
            geminiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
            openAIKey: import.meta.env.VITE_OPENAI_API_KEY || '',
            groqKey: import.meta.env.VITE_GROQ_API_KEY || '',
            activeProvider: 'gemini'
        };
    },

    saveConfig: (config: AIConfig) => {
        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
        // Dispatch event to notify listeners (simple way to update UI/Services if they listened, but services pull on demand usually)
        window.dispatchEvent(new Event('ai-config-changed'));
    },

    getGeminiKey: (): string => {
        const config = AIConfigService.getConfig();
        return config.geminiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
    },

    getOpenAIKey: (): string => {
        const config = AIConfigService.getConfig();
        return config.openAIKey || import.meta.env.VITE_OPENAI_API_KEY || '';
    },

    getGroqKey: (): string => {
        const config = AIConfigService.getConfig();
        return config.groqKey || import.meta.env.VITE_GROQ_API_KEY || '';
    },

    getActiveProvider: (): 'gemini' | 'openai' | 'groq' => {
        return AIConfigService.getConfig().activeProvider;
    }
};
