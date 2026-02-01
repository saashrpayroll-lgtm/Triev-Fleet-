import { Rider, User, Lead } from '@/types';
import { supabase } from '@/config/supabase';
import { AIConfigService } from './AIConfigService';

// --- Configuration ---
const FALLBACK_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const FALLBACK_OPENAI_KEY = ''; // Removed hardcoded key for security

// --- Types ---
export type AiTaskType = 'speed' | 'analysis' | 'creative';
export type AiProvider = 'groq' | 'gemini' | 'openai';

export interface AiOrchestrationResult {
    provider: AiProvider;
    content: string | null;
    latency: number;
    error?: string;
}

// --- Helper Functions ---
const cleanText = (text: string) => text.replace(/\*\*/g, '').replace(/\*/g, '-').trim();

const logAIActivity = async (action: string, provider: string, latency: number, success: boolean) => {
    try {
        await supabase.from('activity_logs').insert({
            details: `AI performed: ${action} (${provider}) - ${latency}ms - ${success ? 'Success' : 'Fail'}`,
            action_type: 'AI_GENERATION',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("Failed to log AI activity", e);
    }
};

// --- System Prompt Injection ---
const GLOBAL_SYSTEM_CONTEXT = `
You are an intelligent, reliable Fleet Management Assistant AI integrated inside a Rider Fleet Web App. Your role is to strictly assist Admins and Team Leaders by answering queries related to riders, wallets, leads, rent, earnings, attendance, payments, reports, and system usage only. Always give clear, short, accurate, and actionable responses based on provided app data or user questions. If real data is missing, politely ask for the required details instead of guessing. Never hallucinate numbers, riders, payments, or records. Support admin decisions, TL workflows, and operational clarity. Respond consistently, safely, and professionally so that live chat never fails or breaks, even if the question is unclear or partial.
`;

// --- AI Orchestrator Class ---
class AIOrchestrator {

    // Decision Logic: Which provider to use?
    private static selectProvider(task: AiTaskType): AiProvider {
        // 1. Check User Override (Future implementation)
        // const config = AIConfigService.getConfig();
        // If user forced a specific provider active, we might respect it, OR strictly follow architecture.
        // For this implementation, we follow ARCHITECTURE unless specific override requested?
        // Let's implement the architecture as requested: Groq=Speed, Gemini=Analysis.

        switch (task) {
            case 'speed':
                // Preferred: Groq. Fallback: OpenAI -> Gemini
                return 'groq';
            case 'analysis':
                // Preferred: Gemini. Fallback: OpenAI -> Groq
                return 'gemini';
            case 'creative':
                return 'openai';
            default:
                return 'gemini';
        }
    }

    // Main Execution Method
    static async execute(task: AiTaskType, prompt: string, systemContext: string = ''): Promise<string | null> {
        const primaryProvider = this.selectProvider(task);
        const startTime = Date.now();

        console.log(`[AI Orchestrator] Task: ${task} | Selected Primary: ${primaryProvider}`);

        // Try Primary
        let result = await this.callProvider(primaryProvider, prompt, systemContext);

        if (result.success && result.content) {
            logAIActivity(task, primaryProvider, Date.now() - startTime, true);
            return result.content;
        }

        // Fallback Logic
        console.warn(`[AI Orchestrator] Primary (${primaryProvider}) failed. Attempting fallback...`);
        const fallbackProvider = primaryProvider === 'groq' ? 'gemini' : 'groq'; // Simple toggle default

        result = await this.callProvider(fallbackProvider, prompt, systemContext);

        logAIActivity(`${task}-fallback`, fallbackProvider, Date.now() - startTime, result.success);
        return result.content; // Might be null
    }

    // Provider Implementations
    private static async callProvider(provider: AiProvider, prompt: string, systemContext: string): Promise<{ success: boolean, content: string | null }> {
        const fullSystemContext = `${GLOBAL_SYSTEM_CONTEXT}\n${systemContext}`;

        try {
            switch (provider) {
                case 'groq': return await this.callGroq(prompt, fullSystemContext);
                case 'gemini': return await this.callGemini(prompt, fullSystemContext);
                case 'openai': return await this.callOpenAI(prompt, fullSystemContext);
                default: return { success: false, content: null };
            }
        } catch (e) {
            console.error(`[AI Orchestrator] Provider ${provider} crashed:`, e);
            return { success: false, content: null };
        }
    }

    // --- Groq Driver ---
    private static async callGroq(prompt: string, system: string) {
        const key = AIConfigService.getGroqKey();
        if (!key) return { success: false, content: null };

        // Ensure system prompt is not empty for Groq
        const safeSystem = system || "You are a helpful assistant.";

        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: safeSystem },
                        { role: "user", content: prompt }
                    ]
                })
            });

            if (!res.ok) {
                const err = await res.text();
                console.error(`[Groq Error] ${res.status}:`, err);
                return { success: false, content: null };
            }

            const data = await res.json();
            return { success: true, content: data.choices?.[0]?.message?.content || null };
        } catch (e) {
            console.error("[Groq Exception]", e);
            return { success: false, content: null };
        }
    }

    // --- Gemini Driver ---
    private static async callGemini(prompt: string, system: string) {
        const key = AIConfigService.getGeminiKey() || FALLBACK_GEMINI_KEY;
        if (!key) return { success: false, content: "Config Error: No Gemini Key" };

        const payload = {
            contents: [{
                parts: [{ text: `${system}\n\nUser Request: ${prompt}` }]
            }]
        };

        try {
            // Attempt: Gemini 2.0 Flash (v1 Stable)
            // Diagnostics confirmed 'gemini-2.0-flash' is available on v1.
            // Previous 'gemini-pro' and 'gemini-1.5-flash' were NOT in the available models list for this key.
            const model = "gemini-2.0-flash";
            let res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.text();
                console.warn(`[Gemini ${model} Error] ${res.status}:`, err);
                return { success: false, content: null };
            }

            const data = await res.json();
            return { success: true, content: data.candidates?.[0]?.content?.parts?.[0]?.text || null };
        } catch (e) {
            console.error("[Gemini Exception]", e);
            return { success: false, content: null };
        }
    }

    // --- OpenAI Driver ---
    private static async callOpenAI(prompt: string, system: string) {
        const key = AIConfigService.getOpenAIKey() || FALLBACK_OPENAI_KEY;
        if (!key) return { success: false, content: null };

        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
                })
            });
            if (!res.ok) {
                console.error(`[OpenAI Error] ${res.status}:`, await res.text());
                return { success: false, content: null };
            }
            const data = await res.json();
            return { success: true, content: data.choices?.[0]?.message?.content || null };
        } catch (e) {
            console.error("[OpenAI Exception]", e);
            return { success: false, content: null };
        }
    }
}


export const AIService = {
    // --- Public API ---

    getDashboardInsights: async (stats: any, role: 'admin' | 'teamLeader'): Promise<string> => {
        const prompt = `Analyze these fleet statistics for a ${role} dashboard and provide a concise, motivating, and actionable 2-sentence summary.\nStats: ${JSON.stringify(stats)}`;
        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Fleet Management Analyst."); // Gemini preferred
        return text ? cleanText(text) : "AI is analyzing your fleet performance...";
    },

    analyzeRiderPerformance: async (rider: Rider): Promise<string> => {
        const prompt = `Analyze this rider's performance briefly (1 sentence) and suggest an action.\nRider: ${rider.riderName}, Status: ${rider.status}, Wallet: ${rider.walletAmount}`;
        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Rider Performance Manager."); // Gemini
        return text ? cleanText(text) : "No specific insights available.";
    },

    generateResolutionSuggestion: async (request: any): Promise<string> => {
        const prompt = `Draft a polite, professional, and concise admin response for this request.\nRequest: ${JSON.stringify(request)}`;
        const text = await AIOrchestrator.execute('speed', prompt, "You are a Customer Support Admin."); // Groq (Fast reply)
        return text ? cleanText(text) : "Request processed successfully.";
    },

    generatePaymentReminder: async (rider: Rider, language: 'hindi' | 'english', tone: string = 'professional'): Promise<string> => {
        const prompt = `Write a payment reminder message for a rider named ${rider.riderName}. debt: ${Math.abs(rider.walletAmount)}. Lang: ${language}. Tone: ${tone}.`;
        const text = await AIOrchestrator.execute('speed', prompt, "You are a Collection Agent."); // Groq
        return text ? cleanText(text) : `Reminder: Please clear your dues of Rs. ${Math.abs(rider.walletAmount)}.`;
    },

    suggestRequestContent: async (userInput: string): Promise<{ subject: string, description: string, type: string } | null> => {
        const prompt = `Based on: "${userInput}", suggest Subject, Description, and Request Type. Output strictly JSON: { "subject": "...", "description": "...", "type": "..." }`;
        const text = await AIOrchestrator.execute('speed', prompt, "You are a Classifier. Output JSON only."); // Groq
        try {
            return JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || 'null');
        } catch (e) { return null; }
    },

    // --- Merged from geminiService ---

    enhanceRemarks: async (rawNotes: string): Promise<string> => {
        const prompt = `Rewrite these administrative notes to be professional and concise:\n"${rawNotes}"`;
        const text = await AIOrchestrator.execute('speed', prompt, "You are an Editor."); // Groq
        return text ? text.trim() : rawNotes;
    },

    parseSearchQuery: async (query: string): Promise<{ role?: string; status?: string; location?: string; keyword?: string; }> => {
        const prompt = `Extract filter parameters from query: "${query}". Return JSON with keys: role, status, location, keyword.`;
        const text = await AIOrchestrator.execute('speed', prompt, "You are a Search Parser. Output JSON only."); // Groq
        try {
            return JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || 'null') || { keyword: query };
        } catch (e) { return { keyword: query }; }
    },

    generateInsights: async (stats: any): Promise<string> => {
        const prompt = `Analyze user statistics and provide 3 bulleted actionable insights.\nStats: ${JSON.stringify(stats)}`;
        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Data Analyst."); // Gemini
        return text || "Failed to generate insights.";
    },

    getTeamPerformanceAnalysis: async (tlData: User, riders: Rider[], leads: Lead[]): Promise<string> => {
        const stats = {
            totalRiders: riders.length,
            activeRiders: riders.filter(r => r.status === 'active').length,
            avgWallet: riders.length > 0 ? riders.reduce((sum, r) => sum + r.walletAmount, 0) / riders.length : 0,
            leadsConverted: leads.filter(l => l.status === 'Convert').length,
            totalLeads: leads.length
        };
        const prompt = `Analyze Team Leader ${tlData.fullName}'s performance based on these metrics: ${JSON.stringify(stats)}. Provide a 2-sentence performance verdict.`;
        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Performance Reviewer.");
        return text ? cleanText(text) : "Performance data being processed.";
    },

    predictChurnRisk: async (rider: Rider): Promise<{ risk: 'Low' | 'Medium' | 'High', reasoning: string }> => {
        const prompt = `Predict churn risk for rider: ${JSON.stringify(rider)}. 
        Consider: negative wallet, frequency of activity, status.
        Output strictly JSON: { "risk": "Low"|"Medium"|"High", "reasoning": "..." }`;
        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Retention Specialist. Output JSON.");
        try {
            return JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || '{"risk": "Low", "reasoning": "Standard activity profile."}');
        } catch (e) {
            return { risk: 'Low', reasoning: 'Data insufficient for accurate prediction.' };
        }
    },

    generateBulkAnnouncement: async (topic: string, target: 'riders' | 'teamLeaders'): Promise<string> => {
        const prompt = `Write a professional announcement for ${target} regarding: "${topic}". Keep it under 200 characters for mobile display.`;
        const text = await AIOrchestrator.execute('creative', prompt, "You are a Communications Manager.");
        return text ? cleanText(text) : `Update on ${topic}. Please check the bulletin.`;
    },

    // --- Lead Scoring ---
    scoreLead: async (leadData: any): Promise<number> => {
        const prompt = `Evaluate this lead for EV leasing potential (0-100). 
        Data: ${JSON.stringify(leadData)}.
        Criteria: 
        - License (Permanent=High, Learning=Med, No=Zero)
        - Client (Zomato/Swiggy = High, Other=Med)
        - EV Interest (High Speed = High)
        - Current EV (Using one = High intent)
        Output JSON only: { "score": number }`;

        try {
            const text = await AIOrchestrator.execute('speed', prompt, "You are a Lead Scorer. Output strictly JSON.");
            const data = JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || '{"score": 50}');
            return Math.min(100, Math.max(0, parseInt(data.score) || 50));
        } catch (e) {
            console.error("Lead scoring failed", e);
            return 50; // Neutral default
        }
    },

    // --- Notification & Recommendations ---

    generateNotificationContent: async (topic: string, role: string, tone: string): Promise<{ title: string, body: string, priority: string, tags: string[], type: string } | null> => {
        const prompt = `Generate a notification for a ${role}. Topic: "${topic}". Tone: ${tone}. Output strictly JSON: { "title": "...", "body": "...", "priority": "high|medium|low", "tags": [], "type": "info" }`;
        const text = await AIOrchestrator.execute('creative', prompt, "You are a UX Writer.");
        try { return JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || 'null'); } catch { return null; }
    },

    getLeadRecommendations: async (lead: any): Promise<string> => {
        const prompt = `Suggest next action for lead: ${JSON.stringify(lead)}. Concise.`;
        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Sales AI.");
        return text ? cleanText(text) : "Review and follow up.";
    },

    calculateRiderScore: (rider: Rider) => {
        // Deterministic logic, no AI call needed
        let score = 100;
        if (rider.status === 'inactive') score -= 20;
        if (rider.status === 'deleted') score -= 50;
        if (rider.walletAmount < 0) {
            const debt = Math.abs(rider.walletAmount);
            if (debt > 5000) score -= 40;
            else if (debt > 2000) score -= 20;
            else score -= 10;
        } else if (rider.walletAmount > 500) {
            score += 5;
        }
        score = Math.max(0, Math.min(100, score));
        let label = 'Excellent';
        let color = 'text-green-600';
        if (score < 50) { label = 'Critical'; color = 'text-red-600'; }
        else if (score < 80) { label = 'At Risk'; color = 'text-orange-500'; }
        return { score, label, color };
    },

    // --- Chat ---
    chatWithBot: async (message: string, history: any[], context: any, _attachmentData?: any): Promise<string> => {
        const system = `You are 'Triev AI', assisting ${context.userName} (${context.role}). Context: ${JSON.stringify(context)}.`;
        // Build conversation string for simplicity in REST usage
        const conversation = history.map((h: any) => `${h.role === 'user' ? 'User' : 'AI'}: ${h.parts[0].text}`).join('\n');
        const prompt = `${conversation}\nUser: ${message}`;

        const text = await AIOrchestrator.execute('speed', prompt, system); // Groq for chat
        return text || "I am currently offline.";
    }
};
