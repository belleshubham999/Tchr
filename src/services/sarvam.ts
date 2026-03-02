const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "";
const SARVAM_API_URL = "https://api.sarvam.ai/v1/chat/completions";

/* ===========================
   TYPES
=========================== */

interface SarvamMessage {
  role: "user" | "assistant";
  content: string;
}

export type AIAction =
  | {
      type: "create_flashcard";
      question: string;
      answer: string;
    }
  | {
      type: "create_note";
      title: string;
      content: string;
      summary: string;
      tags: string[];
    }
  | {
      type: "create_study_plan";
      title: string;
      content: string;
    };

interface AIResponse {
  actions: AIAction[];
  reply?: string;
}

/* ===========================
   SAFE API CALL
=========================== */

async function callSarvamAPI(
  messages: SarvamMessage[],
  retries = 2
): Promise<string> {
  if (!SARVAM_API_KEY) {
    throw new Error("SARVAM_API_KEY is not set");
  }

  try {
    const response = await fetch(SARVAM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: JSON.stringify({
        model: "sarvam-m",
        messages,
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sarvam API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    if (retries > 0) return callSarvamAPI(messages, retries - 1);
    throw err;
  }
}

/* ===========================
   MESSAGE BUILDER (STRICT ALTERNATION)
=========================== */

function buildMessages(
  chatHistory: { role: "user" | "ai"; text: string }[],
  newMessage: string
): SarvamMessage[] {
  const messages: SarvamMessage[] = [];

  const systemInstruction = `
You are an AI tutor.

You MUST respond in valid JSON only.
No markdown.
No explanations.
No extra text.

Return JSON in this format:

{
  "actions": [
    {
      "type": "create_flashcard",
      "question": "string",
      "answer": "string"
    },
    {
      "type": "create_note",
      "title": "string",
      "content": "string",
      "summary": "string",
      "tags": ["string"]
    },
    {
      "type": "create_study_plan",
      "title": "string",
      "content": "string"
    }
  ],
  "reply": "optional normal response"
}

If no creation is needed, return:

{
  "actions": [],
  "reply": "normal message"
}

English only.
`;

  // First message MUST be user
  messages.push({
    role: "user",
    content: systemInstruction,
  });

  let lastRole: "user" | "assistant" = "user";

  const recent = chatHistory.slice(-6);

  for (const msg of recent) {
    const role = msg.role === "user" ? "user" : "assistant";
    if (role === lastRole) continue;

    messages.push({ role, content: msg.text });
    lastRole = role;
  }

  if (lastRole !== "assistant") {
    messages.push({
      role: "assistant",
      content: "Understood.",
    });
  }

  messages.push({
    role: "user",
    content: newMessage,
  });

  return messages;
}

/* ===========================
   MAIN FUNCTION
=========================== */

export async function tutorChat(
  chatHistory: { role: "user" | "ai"; text: string }[],
  message: string,
  onToolCall?: (actions: AIAction[]) => void
): Promise<string> {
  const messages = buildMessages(chatHistory, message);

  const raw = await callSarvamAPI(messages);

  // Try to parse as AIResponse first (with actions)
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Not JSON, return raw response
      return raw;
    }

    const parsed = JSON.parse(jsonMatch[0]) as AIResponse;

    if (parsed.actions && parsed.actions.length > 0 && onToolCall) {
      onToolCall(parsed.actions);

      const counts = {
        flashcards: parsed.actions.filter(a => a.type === "create_flashcard")
          .length,
        notes: parsed.actions.filter(a => a.type === "create_note").length,
        plans: parsed.actions.filter(a => a.type === "create_study_plan").length,
      };

      if (counts.flashcards)
        return `Created ${counts.flashcards} flashcard(s).`;
      if (counts.notes) return `Created ${counts.notes} note(s).`;
      if (counts.plans)
        return `Created ${counts.plans} study plan(s).`;

      return "Processed.";
    }

    return parsed.reply || raw;
  } catch {
    // If JSON parsing fails, return raw response
    return raw;
  }
}