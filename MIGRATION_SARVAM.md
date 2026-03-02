# Migration from Gemini to Sarvam AI

This document outlines the migration from Google's Gemini API to Sarvam AI.

## Changes Made

### 1. Dependencies
- **Removed**: `@google/genai` package
- **No new package**: Sarvam AI uses standard HTTP requests (native `fetch` API)

### 2. Environment Variables
- **Old**: `GEMINI_API_KEY`
- **New**: `SARVAM_API_KEY`

Update your `.env` file:
```env
SARVAM_API_KEY=your_sarvam_api_key_here
```

### 3. Configuration
- Updated `vite.config.ts` to inject `SARVAM_API_KEY` instead of `GEMINI_API_KEY`
- Removed `@google/genai` from Rollup manual chunks

### 4. Service Migration

**Old**: `src/services/gemini.ts` - Removed
**New**: `src/services/sarvam.ts` - Uses REST API directly

#### Key differences:
- **Model**: Changed from `gemini-3-flash-preview` to `Sarvam-M`
- **API Format**: REST API with Bearer token authentication
- **Response Format**: Standard OpenAI-compatible chat completions format
- **Tool Calling**: Limited native tool calling; responses are parsed for action keywords instead

### 5. Files Updated
- `src/App.tsx` - Updated import to `./services/sarvam`
- `src/components/ExamPage.tsx` - Updated import to `./services/sarvam`
- `package.json` - Removed `@google/genai`
- `vite.config.ts` - Updated API key and build configuration

## API Endpoints

Sarvam AI Chat Completion API:
```
POST https://api.sarvam.ai/chat/completions
```

Headers:
```
Authorization: Bearer {SARVAM_API_KEY}
Content-Type: application/json
```

## Features Maintained

✅ Note analysis with summary, tags, and flashcard generation
✅ AI tutor chat with multi-turn conversation
✅ Study plan recommendations
✅ Exam generation and evaluation
✅ Support for Indian languages (Hindi, Tamil, Telugu, etc.)

## Getting Started

1. Get your Sarvam API key from https://sarvam.ai/
2. Add `SARVAM_API_KEY` to your `.env` file
3. Run `npm install` (to remove @google/genai)
4. Run `npm run build`
5. Deploy and test!

## Notes

- Sarvam AI has native support for Indian languages and cultural context
- The API uses the "Sarvam-M" 24-billion parameter model
- Response parsing for flashcard JSON is more flexible to handle various response formats
