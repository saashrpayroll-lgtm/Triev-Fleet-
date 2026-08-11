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

    // --- Groq Driver (Sub-second Speed Engine) ---
    private static async callGroq(prompt: string, system: string) {
        const key = AIConfigService.getGroqKey();
        if (!key) return { success: false, content: null };

        const safeSystem = system || "You are a helpful assistant.";
        const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];

        for (const model of models) {
            try {
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: "system", content: safeSystem },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.3
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    const content = data.choices?.[0]?.message?.content || null;
                    if (content) return { success: true, content };
                } else {
                    console.warn(`[Groq ${model} Warning] Status ${res.status}, trying fallback model...`);
                }
            } catch (e) {
                console.error(`[Groq ${model} Exception]`, e);
            }
        }
        return { success: false, content: null };
    }

    // --- Gemini Driver (Deep Fleet Analytics Engine) ---
    private static async callGemini(prompt: string, system: string) {
        const key = AIConfigService.getGeminiKey() || FALLBACK_GEMINI_KEY;
        if (!key) return { success: false, content: "Config Error: No Gemini Key" };

        const payload = {
            contents: [{
                parts: [{ text: `${system}\n\nUser Request: ${prompt}` }]
            }]
        };

        const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

        for (const model of models) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
                    if (content) return { success: true, content };
                } else {
                    console.warn(`[Gemini ${model} Warning] Status ${res.status}, trying fallback model...`);
                }
            } catch (e) {
                console.error(`[Gemini ${model} Exception]`, e);
            }
        }
        return { success: false, content: null };
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
        const walletAmt = rider.walletAmount;
        // Keep the minus sign! Show actual amount so AI knows the rider is negative
        const amountStr = walletAmt.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
        const name = rider.riderName;

        // Determine severity based on how negative they are
        const absAmt = Math.abs(walletAmt);
        let severity = 'Low Negative';
        let severityHint = 'Polite but firm — nudge them to clear a small pending amount.';
        if (absAmt >= 500) {
            severity = 'High Negative';
            severityHint = 'Serious and assertive — emphasize that this is overdue and must be cleared immediately.';
        }
        if (absAmt >= 700) {
            severity = 'Critical Negative';
            severityHint = 'Very stern and authoritative — warn that continued non-payment will lead to escalation.';
        }

        const languageInstruction = language === 'hindi' ? 'OUTPUT MUST BE IN PURE HINDI (Devanagari script).' : 'Write the message in English.';
        const toneInstruction = tone === 'professional' ? 'professional and respectful' : tone === 'friendly' ? 'friendly and polite' : 'urgent but respectful';

        const variations = [
            "Focus on immediate payment to avoid service interruption.",
            "Focus on maintaining a good relationship.",
            "Focus on the outstanding balance size.",
            "Short and direct.",
            "Slightly detailed explanation."
        ];
        const randomFocus = variations[Math.floor(Math.random() * variations.length)];

        const prompt = `Generate a UNIQUE WhatsApp payment reminder for a rider who has a NEGATIVE wallet balance (owes money).
Rider Name: ${name}
Wallet Balance: ${amountStr}
Severity Level: ${severity}

INSTRUCTIONS:
1. ${languageInstruction}
2. Tone: ${toneInstruction}. Severity hint: ${severityHint}
3. CRITICAL: The rider's balance is NEGATIVE — they OWE money. Always show the amount with the minus (−) sign, e.g., "*${amountStr}*". Use words like "बकाया" (dues), "pending amount", "overdue" — NEVER words like "top-up" or "recharge".
4. The message MUST include the Rider Name ("${name}") and the exact Amount ("${amountStr}") clearly.
5. VARIATION INSTRUCTION: ${randomFocus}
6. Keep it concise (2-3 sentences).
7. Do not include any introductory text, just the message body.

Return ONLY the final message text ready to send.`;

        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Professional Payment Recovery Specialist.");

        if (text) return cleanText(text);

        // Fallbacks — keep minus sign
        if (language === 'hindi') {
            return `नमस्ते *${name}*, आपके वॉलेट में *${amountStr}* का बकाया है। कृपया अपनी सेवाओं को जारी रखने के लिए इसे जल्द से जल्द क्लियर करें। धन्यवाद।`;
        }
        return `Dear *${name}*, your wallet balance is *${amountStr}*. Please clear your pending dues at the earliest to avoid service interruption. Thank you!`;
    },

    generateLowBalanceReminder: async (rider: any, language: 'hindi' | 'english'): Promise<string> => {
        // Low balance riders are POSITIVE (₹0 to ₹250) — no Math.abs() needed, show actual balance
        const amountStr = rider.walletAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
        const name = rider.riderName;

        const languageInstruction = language === 'hindi' ? 'OUTPUT MUST BE IN PURE HINDI (Devanagari script).' : 'Write the message in English.';

        const variations = [
            "Focus on maintaining a seamless, uninterrupted EV riding experience.",
            "Focus on preventing future negative balances.",
            "Be very cheerful and encouraging.",
            "Keep it extremely brief and helpful."
        ];
        const randomFocus = variations[Math.floor(Math.random() * variations.length)];

        const prompt = `Generate a UNIQUE, FRIENDLY WhatsApp reminder for a rider whose wallet balance is running very low (between ₹0 and ₹250). This rider is NOT in negative — they just need a top-up.
Rider Name: ${name}
Current Wallet Balance: ${amountStr} (POSITIVE but low)

INSTRUCTIONS:
1. ${languageInstruction}
2. Tone: Helpful, proactive, friendly, and non-threatening.
3. ABSOLUTE RULE: This rider does NOT owe any money. Do NOT use words like "बकाया" (dues), "outstanding", "recovery", "penalty", "overdue", or "clear dues". These are FORBIDDEN.
4. INSTEAD, strictly use words like "Top-Up", "Recharge", "बैलेंस बनाए रखें" (maintain balance), "टॉप-अप करें". Encourage them to maintain at least ₹250 for uninterrupted rides.
5. The message MUST include the Rider Name ("${name}") and the Current Balance ("${amountStr}").
6. VARIATION INSTRUCTION: ${randomFocus} (Ensure the message feels fresh/unique).
7. Keep it concise (2-3 sentences max).

Return ONLY the final message text ready to send.`;

        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Proactive Rider Success Manager.");

        if (text) return cleanText(text);

        if (language === 'hindi') {
            return `नमस्ते *${name}*, आपका वर्तमान वॉलेट बैलेंस *${amountStr}* है। निर्बाध राइडिंग अनुभव के लिए कृपया अपने वॉलेट में टॉप-अप करें और कम से कम ₹250 का बैलेंस बनाए रखें। सुरक्षित सवारी करें! 🛵`;
        }
        return `Hello *${name}*, your current wallet balance is *${amountStr}*. Please do a quick top-up to maintain at least ₹250 for an uninterrupted riding experience. Ride safe! 🛵`;
    },

    generateRecoveryMessage: async (rider: any, language: 'hindi' | 'english'): Promise<string> => {
        // Critical negative — keep the minus sign to show severity
        const amountStr = rider.walletAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
        const name = rider.riderName;

        const languageInstruction = language === 'hindi' ? 'OUTPUT MUST BE IN PURE HINDI (Devanagari script).' : 'Write the message in English.';

        const variations = [
            "Emphasize the immediate assignment of the team.",
            "Emphasize the consequences of non-payment.",
            "Be extremely short and stern.",
            "Frame it as a 'Final Notice'.",
            "Focus on the 'Vehicle Seizure' risk."
        ];
        const randomFocus = variations[Math.floor(Math.random() * variations.length)];

        const prompt = `Generate a STERN vehicle recovery warning for a rider with CRITICAL negative wallet balance (serious defaulter).
Rider Name: ${name}
Wallet Balance: ${amountStr} (CRITICAL NEGATIVE — this rider owes a large sum)

INSTRUCTIONS:
1. ${languageInstruction}
2. Tone: Urgent, Authoritative, and VERY SERIOUS. This is a critical defaulter.
3. CRITICAL: Always show the amount exactly as "*${amountStr}*" with the minus (−) sign. The negative sign conveys the seriousness.
4. Do NOT mention "legal action", "police", or "seizure".
5. INSTEAD, strictly say that the "**Hard Recovery Team**" (or "**हार्ड रिकवरी टीम**" in Hindi) will be assigned to recover the vehicle if dues are not cleared.
6. The message MUST include the Rider Name ("${name}") and the exact Amount ("${amountStr}").
7. VARIATION INSTRUCTION: ${randomFocus} (Ensure the message feels fresh/unique).
8. Keep it concise (2 sentences max).

Return ONLY the final message text ready to send.`;

        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Compliance Officer.");

        if (text) return cleanText(text);

        if (language === 'hindi') {
            return `🚨 चेतावनी: *${name}*, आपके वॉलेट में *${amountStr}* का गंभीर बकाया है। तुरंत भुगतान करें अन्यथा वाहन रिकवर करने के लिए **हार्ड रिकवरी टीम** को भेजा जाएगा।`;
        }
        return `🚨 URGENT: *${name}*, your wallet balance is *${amountStr}* — critically overdue. Pay immediately or the **Hard Recovery Team** will be assigned to recover the vehicle.`;
    },

    generateReactivationMessage: async (rider: any, language: 'hindi' | 'english'): Promise<string> => {
        const name = rider.riderName;
        const languageInstruction = language === 'hindi' ? 'OUTPUT MUST BE IN PURE HINDI (Devanagari script).' : 'Write the message in English.';

        const prompt = `Generate a polite and encouraging reactivation message for an inactive EV rider.
Rider Name: ${name}

INSTRUCTIONS:
1. ${languageInstruction}
2. Tone: Friendly, encouraging, and supportive.
3. The message MUST include the Rider Name ("${name}").
4. Tell them we miss them and encourage them to get back on the road. Ask if they are facing any issues we can help solve.
5. Keep it concise (2-3 sentences max).

Return ONLY the final message text ready to send.`;

        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Rider Retention Specialist.");
        if (text) return cleanText(text);

        if (language === 'hindi') {
            return `नमस्ते *${name}*, हमने देखा कि आप कुछ समय से इनएक्टिव हैं। हम आपको मिस कर रहे हैं! क्या कोई समस्या है जिसमें हम मदद कर सकते हैं? कृपया संपर्क करें।`;
        }
        return `Hello *${name}*, we noticed you've been inactive lately. We miss having you on the road! Are you facing any issues we can help with? Please reach out to us.`;
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
        // Realistic Dynamic AI Score Algorithm
        let score = 100;

        // 1. Status Penalties
        if (rider.status === 'inactive') score -= 30;
        if (rider.status === 'deleted') score -= 50;

        // 2. Financial Metrics (Wallet Balance)
        if (rider.walletAmount < 0) {
            const debt = Math.abs(rider.walletAmount);
            // Aggressive scaling: -5 points for every ₹500 negative, max penalty 60
            const debtPenalty = Math.min(60, Math.floor(debt / 500) * 5);
            score -= Math.max(10, debtPenalty); // At least -10 if negative
        } else if (rider.walletAmount === 0) {
            // Idle / Zero Balance Penalty
            score -= 15;
        } else {
            // Positive Balance Bonus
            if (rider.walletAmount > 1000) score += 10;
            else if (rider.walletAmount > 250) score += 5;
        }

        // 3. Age / Loyalty Metrics
        if (rider.allotmentDate) {
            const daysActive = (new Date().getTime() - new Date(rider.allotmentDate).getTime()) / (1000 * 3600 * 24);
            // If active > 30 days and NOT in severe negative balance, evaluate loyalty
            // Only reward loyalty if they are generally performing well or just slightly zero
            if (daysActive > 30 && rider.walletAmount >= 0 && rider.status === 'active') {
                const loyaltyBonus = Math.min(15, Math.floor(daysActive / 30) * 2); // +2 for every month, max +15
                score += loyaltyBonus;
            }
        }

        // Ensure bounds
        score = Math.floor(Math.max(0, Math.min(100, score)));

        // 4. Label and Coloring
        let label = 'Excellent';
        let color = 'text-emerald-500';

        if (score < 40) {
            label = 'Critical Risk';
            color = 'text-red-500';
        } else if (score < 70) {
            label = 'Needs Attention';
            color = 'text-orange-500';
        } else if (score < 85) {
            label = 'Good';
            color = 'text-blue-500';
        }

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
    },

    // --- Autonomous Virtual Team Leader Operations Plan ---
    generateDailyOperationsPlan: async (data: { riders: Rider[], leads?: Lead[], requests?: any[] }, role: string): Promise<{
        summary: string;
        debtRecoveryActions: { riderName: string; walletAmount: number; priority: 'high' | 'critical' | 'medium'; action: string }[];
        hardRecoveryEscalations: { riderName: string; debtAmount: number; reason: string }[];
        leadActions: { leadName: string; phone?: string; recommendation: string }[];
    }> => {
        const activeRiders = data.riders.filter(r => r.status === 'active');
        const negativeRiders = activeRiders.filter(r => r.walletAmount < 0).sort((a, b) => a.walletAmount - b.walletAmount);
        const criticalDebtors = negativeRiders.filter(r => r.walletAmount <= -1500);

        const prompt = `Generate a precise daily operations action plan for a ${role}.
Stats: Active Riders: ${activeRiders.length}, Total Negative Debtors: ${negativeRiders.length}, Heavy Debtors (<-1500): ${criticalDebtors.length}, Leads Count: ${data.leads?.length || 0}.
Top Debtors: ${JSON.stringify(negativeRiders.slice(0, 5).map(r => ({ name: r.riderName, wallet: r.walletAmount })))}.

Instructions:
Output strictly JSON matching this structure:
{
  "summary": "2-sentence overall daily directive",
  "debtRecoveryActions": [ { "riderName": "...", "walletAmount": -1000, "priority": "high", "action": "..." } ],
  "hardRecoveryEscalations": [ { "riderName": "...", "debtAmount": 2000, "reason": "..." } ],
  "leadActions": [ { "leadName": "...", "phone": "...", "recommendation": "..." } ]
}`;

        const text = await AIOrchestrator.execute('analysis', prompt, "You are a Chief Fleet Operations Officer. Output strictly JSON.");
        try {
            const parsed = JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || 'null');
            if (parsed && parsed.summary) return parsed;
        } catch (e) {
            console.error("AI operations plan parse error", e);
        }

        // Reliable Fallback
        return {
            summary: `Focus today on ${negativeRiders.length} unpaid debt accounts and ${criticalDebtors.length} critical defaulters needing immediate escalation.`,
            debtRecoveryActions: negativeRiders.slice(0, 4).map(r => ({
                riderName: r.riderName,
                walletAmount: r.walletAmount,
                priority: r.walletAmount <= -1500 ? 'critical' : 'high',
                action: r.walletAmount <= -1500 ? 'Assign Hard Recovery Team & call immediately' : 'Send WhatsApp payment reminder & follow up'
            })),
            hardRecoveryEscalations: criticalDebtors.map(r => ({
                riderName: r.riderName,
                debtAmount: Math.abs(r.walletAmount),
                reason: 'Wallet balance exceeds -₹1,500 threshold'
            })),
            leadActions: (data.leads || []).slice(0, 3).map(l => ({
                leadName: l.riderName,
                phone: l.mobileNumber,
                recommendation: 'Contact within 24h to complete EV leasing onboarding'
            }))
        };
    },

    // --- Multilingual Smart Calling Script Generator ---
    generateSmartCallScript: async (rider: { riderName: string; walletAmount: number; clientName?: string }): Promise<{
        hindiScript: string;
        englishScript: string;
        whatsappHindi: string;
        whatsappEnglish: string;
    }> => {
        const debtAmt = Math.abs(rider.walletAmount);
        const prompt = `Generate phone call scripts and WhatsApp messages in BOTH Hindi (Devanagari) and English for a fleet rider owing money.
Rider Name: ${rider.riderName}
Wallet Balance: -₹${debtAmt}

Output strictly JSON with keys: "hindiScript", "englishScript", "whatsappHindi", "whatsappEnglish".`;

        const text = await AIOrchestrator.execute('speed', prompt, "You are an Expert Customer Communication Specialist. Output strictly JSON.");
        try {
            const parsed = JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || 'null');
            if (parsed && parsed.hindiScript) return parsed;
        } catch (e) {
            console.error("Smart script parse error", e);
        }

        return {
            hindiScript: `नमस्ते ${rider.riderName} जी, मैं ट्रिएव फ़्लीट से बात कर रहा हूँ। आपके वॉलेट में -₹${debtAmt} का बकाया है। क्या आप आज यूपीआई द्वारा इसका भुगतान कर सकते हैं?`,
            englishScript: `Hello ${rider.riderName}, calling from Triev Fleet. Your wallet has a pending balance of -₹${debtAmt}. Can you clear this today via UPI?`,
            whatsappHindi: `नमस्ते *${rider.riderName}*, आपके वॉलेट में *-₹${debtAmt}* का बकाया है। कृपया सेवा जारी रखने के लिए आज ही भुगतान करें। धन्यवाद!`,
            whatsappEnglish: `Hello *${rider.riderName}*, your wallet balance is *-₹${debtAmt}*. Please make the payment today to avoid service interruption. Thank you!`
        };
    }
};
