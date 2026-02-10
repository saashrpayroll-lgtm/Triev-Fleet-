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
You are 'Triev AI', the advanced AI Assistant for the Triev Rider Pro application.
Your goal is to assist Admins, Team Leaders (TLs), and Riders with accurate, helpful, and role-aware information.

--- SYSTEM KNOWLEDGE BASE ---

1. **User Roles**:
   - **Admin**: Full access. Can manage users, riders, leads, wallets, reports, and system settings.
   - **Team Leader (TL)**: Manages a specific group of Riders. Can view their riders' performance, wallets, and attendance. Cannot delete users or see system-wide financial logs unless permitted.
   - **Rider**: The end-user driving EVs. Can view their own wallet, Profile, Attendance, and raise Requests.

2. **Core Features**:
   - **Rider Management**: Riders have profiles with Triev ID (e.g., TR123), Name, Mobile, Chassis No., and Wallet Balance.
   - **Wallet System**: 
     - **Positive Balance**: Rider has prepaid/excess funds.
     - **Negative Balance**: Rider owes money (Rent/EMI due).
     - **Transactions**: Admins can add/deduct funds.
   - **Leads**: Potential new riders. Stages: New -> Contacted -> Interested -> Converted (Rider) -> Closed.
   - **Requests (Tickets)**: Riders raise requests for 'Vehicle Issue', 'Payment Issue', 'Leave', etc. Admins/TLs resolve them.
   - **Attendance**: Tracked daily. Riders mark in/out.

3. **Operational Rules**:
   - Riders must maintain a non-negative wallet balance to avoid suspension.
   - TLs are assigned riders based on regions or bulk assignment.
   - Rent is deducted weekly/monthly based on the plan.

4. **Tone & Style**:
   - Be professional, concise, and helpful.
   - If a user asks about "My Wallet", look at the context provided (walletAmount).
   - If asking about "System", explain the features above.
   - Never hallucinate data. If you don't know, say "I don't have that specific record right now."

--- END OF KNOWLEDGE BASE ---
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

        // console.log(`[AI Orchestrator] Task: ${task} | Selected Primary: ${primaryProvider}`);

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
                console.error(`[Groq Error] ${res.status}`);
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
                console.warn(`[Gemini ${model} Error] ${res.status}`);
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
                console.error(`[OpenAI Error] ${res.status}`);
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

    suggestRiderNotes: async (riderData: { riderName?: string; clientName?: string; status?: string; walletAmount?: number }): Promise<string> => {
        const prompt = `Generate professional onboarding notes for a new rider with the following details:
Name: ${riderData.riderName || 'New Rider'}
Client: ${riderData.clientName || 'Not specified'}
Status: ${riderData.status || 'active'}
Wallet: ₹${riderData.walletAmount || 0}

Provide 2-3 concise bullet points about onboarding checklist, expectations, or initial observations.`;
        const text = await AIOrchestrator.execute('speed', prompt, "You are a Fleet Onboarding Specialist."); // Groq
        return text ? cleanText(text) : "- New rider onboarded\n- Verify all documents\n- Schedule orientation";
    },

    generatePaymentReminder: async (rider: any, language: 'hindi' | 'english', tone: 'professional' | 'friendly' | 'urgent'): Promise<string> => {
        const amountStr = Math.abs(rider.walletAmount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
        const name = rider.riderName;

        const languageInstruction = language === 'hindi' ? 'OUTPUT MUST BE IN PURE HINDI (Devanagari script).' : 'Write the message in English.';
        const toneInstruction = tone === 'professional' ? 'professional and respectful' : tone === 'friendly' ? 'friendly and polite' : 'urgent but respectful';

        // Add randomness factor
        const variations = [
            "Focus on immediate payment to avoid service interruption.",
            "Focus on maintaining a good relationship.",
            "Focus on the outstanding balance size.",
            "Short and direct.",
            "Slightly detailed explanation."
        ];
        const randomFocus = variations[Math.floor(Math.random() * variations.length)];

        const prompt = `Generate a UNIQUE WhatsApp payment reminder for a rider.
Rider Name: ${name}
Outstanding Amount: ${amountStr}

INSTRUCTIONS:
1. ${languageInstruction}
2. Tone: ${toneInstruction}
3. The message MUST include the Rider Name ("${name}") and the Amount ("${amountStr}") clearly.
4. VARIATION INSTRUCTION: ${randomFocus}
5. Keep it concise (2-3 sentences).
6. Do not include any introductory text, just the message body.

Return ONLY the final message text ready to send.`;

        // Use 'analysis' (Gemini) for better multi-lingual support than Groq
        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Professional Payment Reminder Specialist.");

        if (text) return cleanText(text);

        // Fallbacks
        if (language === 'hindi') {
            return `नमस्ते *${name}*, आपके वॉलेट में *${amountStr}* की बकाया राशि है। कृपया अपनी सेवाओं को जारी रखने के लिए इसे जल्द से जल्द क्लियर करें। धन्यवाद।`;
        }
        return `Dear *${name}*, this is a friendly reminder about your outstanding balance of *${amountStr}*. Please clear your dues at the earliest. Thank you!`;
    },

    generateRecoveryMessage: async (rider: any, language: 'hindi' | 'english'): Promise<string> => {
        const amountStr = Math.abs(rider.walletAmount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
        const name = rider.riderName;

        const languageInstruction = language === 'hindi' ? 'OUTPUT MUST BE IN PURE HINDI (Devanagari script).' : 'Write the message in English.';

        // Add randomness factor for recovery
        const variations = [
            "Emphasize the immediate assignment of the team.",
            "Emphasize the consequences of non-payment.",
            "Be extremely short and stern.",
            "Frame it as a 'Final Notice'.",
            "Focus on the 'Vehicle Seizure' risk."
        ];
        const randomFocus = variations[Math.floor(Math.random() * variations.length)];

        const prompt = `Generate a STERN vehicle recovery warning for a rider with HIGH negative wallet balance.
Rider Name: ${name}
Outstanding Amount: ${amountStr}

INSTRUCTIONS:
1. ${languageInstruction}
2. Tone: Urgent and Authoritative.
3. CRITICAL: Do NOT mention "legal action", "police", or "seizure". 
4. INSTEAD, strictly say that the "**Hard Recovery Team**" (or "**हार्ड रिकवरी टीम**" in Hindi) will be assigned to recover the vehicle if dues are not cleared.
5. The message MUST include the Rider Name ("${name}") and the Amount ("${amountStr}").
6. VARIATION INSTRUCTION: ${randomFocus} (Ensure the message feels fresh/unique).
7. Keep it concise (2 sentences max).

Return ONLY the final message text ready to send.`;

        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Compliance Officer.");

        if (text) return cleanText(text);

        if (language === 'hindi') {
            return `चेतावनी: *${name}*, आपके वॉलेट में *${amountStr}* का गंभीर बकाया है। तुरंत भुगतान करें अन्यथा वाहन जब्त करने के लिए **हार्ड रिकवरी टीम** को भेजा जाएगा।`;
        }
        return `URGENT: *${name}*, your outstanding dues of *${amountStr}* are critical. Pay immediately or the **Hard Recovery Team** will be assigned to recover the vehicle.`;
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
        let system = `You are 'Triev AI', assisting ${context.userName} (${context.role}). Context: ${JSON.stringify(context)}.`;

        if (context.stats) {
            system += `\n\n[LIVE DASHBOARD STATS]:
- Active Riders: ${context.stats.activeRiders}
- Total Riders: ${context.stats.totalRiders}
- Total Leads: ${context.stats.totalLeads}
- Total Wallet Balance: ₹${context.stats.totalWallet}
(Use these numbers to answer user queries accurately. Do not invent numbers.)\n`;
        }

        const conversation = history.map((h: any) => `${h.role === 'user' ? 'User' : 'AI'}: ${h.parts[0].text}`).join('\n');
        const prompt = `${conversation}\nUser: ${message}`;

        const text = await AIOrchestrator.execute('speed', prompt, system); // Groq for chat
        return text || "I am currently offline.";
    }
};
