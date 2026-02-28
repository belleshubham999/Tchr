import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

let aiInstance: any = null;
function getAI() {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }
  return aiInstance;
}

export const geminiModel = "gemini-3-flash-preview";

export interface NoteAnalysis {
  summary: string;
  tags: string[];
  flashcards: { question: string; answer: string }[];
}

const tools: { functionDeclarations: FunctionDeclaration[] }[] = [{
  functionDeclarations: [
    {
      name: "create_note",
      description: "Create a new study note.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "The title of the note." },
          content: { type: Type.STRING, description: "The full content of the note." },
          summary: { type: Type.STRING, description: "A brief summary of the note." },
          tags: { type: Type.STRING, description: "Comma-separated tags for the note." }
        },
        required: ["title", "content"]
      }
    },
    {
      name: "update_note",
      description: "Update an existing study note.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER, description: "The ID of the note to update." },
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          summary: { type: Type.STRING },
          tags: { type: Type.STRING }
        },
        required: ["id"]
      }
    },
    {
      name: "delete_note",
      description: "Delete a study note.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER, description: "The ID of the note to delete." }
        },
        required: ["id"]
      }
    },
    {
      name: "create_flashcard",
      description: "Create a new flashcard. Can be standalone or linked to a note.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Title for standalone flashcard (optional if note_id provided)" },
          note_id: { type: Type.NUMBER, description: "The ID of the note this flashcard belongs to (optional for standalone)" },
          question: { type: Type.STRING },
          answer: { type: Type.STRING }
        },
        required: ["question", "answer"]
      }
    },
    {
      name: "update_flashcard",
      description: "Update an existing flashcard.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER, description: "The ID of the flashcard to update." },
          question: { type: Type.STRING },
          answer: { type: Type.STRING }
        },
        required: ["id"]
      }
    },
    {
      name: "delete_flashcard",
      description: "Delete a flashcard.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER, description: "The ID of the flashcard to delete." }
        },
        required: ["id"]
      }
    },
    {
      name: "create_study_plan",
      description: "Create a new personalized study plan.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "The title of the study plan." },
          content: { type: Type.STRING, description: "The detailed content of the study plan." }
        },
        required: ["title", "content"]
      }
    },
    {
      name: "update_study_plan",
      description: "Update an existing study plan.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER, description: "The ID of the study plan to update." },
          title: { type: Type.STRING, description: "The updated title." },
          content: { type: Type.STRING, description: "The updated content." }
        },
        required: ["id"]
      }
    },
    {
      name: "delete_study_plan",
      description: "Delete a study plan.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER, description: "The ID of the study plan to delete." }
        },
        required: ["id"]
      }
    }
  ]
}];

export async function analyzeNote(content: string): Promise<NoteAnalysis> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: geminiModel,
    contents: `Analyze the following student notes. Provide a concise summary, a list of relevant tags, and generate 3-5 flashcards (question and answer pairs) for key concepts.
    
    Notes:
    ${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING }
              },
              required: ["question", "answer"]
            }
          }
        },
        required: ["summary", "tags", "flashcards"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function tutorChat(
  chatHistory: { role: 'user' | 'ai'; text: string }[],
  message: string,
  onToolCall?: (calls: any[]) => void,
  studyPlans?: any[]
) {
  const ai = getAI();
  const studyPlansContext = studyPlans && studyPlans.length > 0
    ? `\n\nExisting Study Plans:\n${studyPlans.map((p: any) => `\n**${p.title}** (ID: ${p.id}):\n${p.content}`).join('\n\n')}`
    : "";

  const chat = ai.chats.create({
    model: geminiModel,
    config: {
      systemInstruction: `You are 'Tchr', a helpful and encouraging AI tutor. You can manage notes, flashcards, and study plans for the user. 
You can:
- Create standalone flashcards (without a note) by providing a title and question/answer pair, or create flashcards linked to existing notes
- Create, update, and delete study plans
If the user asks to create, edit, delete, or update a note, flashcard, or study plan, use the provided tools. Always confirm actions with the user.
Here are the user's current study plans:${studyPlansContext}`,
      tools: tools
    }
  });

  // Send only the last 4 turns (2 user + 2 ai) to maintain context while being token-efficient
  const recentHistory = chatHistory.slice(-4);
  
  for (const msg of recentHistory) {
    const role = msg.role === 'user' ? 'user' : 'model';
    await chat.sendMessage({ message: msg.text, index: 0 });
  }

  const response = await chat.sendMessage({ message });

  if (response.functionCalls && onToolCall) {
    onToolCall(response.functionCalls);
  }

  return response.text;
}
