export const AI_CONFIG_KEY = 'TRIEV_AI_CONFIG';

export interface AIConfig {
    geminiKey: string;
    openAIKey: string;
    groqKey: string;
    mistralKey: string;  // Engine #3 — Multilingual (Hindi) + Structured JSON
    activeProvider: 'gemini' | 'openai' | 'groq' | 'mistral';
}

export const AIConfigService = {
    getConfig: (): AIConfig => {
        const localConfig = localStorage.getItem(AI_CONFIG_KEY);
        let parsed: Partial<AIConfig> = {};
        if (localConfig) {
            try {
                parsed = JSON.parse(localConfig);
            } catch (e) {
                console.error('[AIConfigService] Error parsing local config', e);
            }
        }
        return {
            geminiKey:  parsed.geminiKey  || import.meta.env.VITE_GEMINI_API_KEY  || '',
            openAIKey:  parsed.openAIKey  || import.meta.env.VITE_OPENAI_API_KEY  || '',
            groqKey:    parsed.groqKey    || import.meta.env.VITE_GROQ_API_KEY    || '',
            mistralKey: parsed.mistralKey || import.meta.env.VITE_MISTRAL_API_KEY || import.meta.env.VITE_MISTRAL_KEY || '',
            activeProvider: parsed.activeProvider || 'gemini'
        };
    },

    saveConfig: (config: AIConfig) => {
        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
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

    getMistralKey: (): string => {
        const config = AIConfigService.getConfig();
        return config.mistralKey || import.meta.env.VITE_MISTRAL_API_KEY || import.meta.env.VITE_MISTRAL_KEY || '';
    },

    getActiveProvider: (): 'gemini' | 'openai' | 'groq' | 'mistral' => {
        return AIConfigService.getConfig().activeProvider;
    }
};
