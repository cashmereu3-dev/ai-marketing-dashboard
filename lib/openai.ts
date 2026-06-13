// lib/openai.ts
/**
 * Simple OpenAI wrapper.
 * If OPENAI_API_KEY is present, the real client will be used.
 * Otherwise a deterministic mock implementation is provided.
 */

let openaiClient: any = null;

if (process.env.OPENAI_API_KEY) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { OpenAIApi, Configuration } = require('openai');
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  openaiClient = new OpenAIApi(configuration);
} else {
  // Mock client – returns placeholder text and fake embeddings
  openaiClient = {
    async createChatCompletion(_: any) {
      return {
        data: {
          choices: [{ message: { content: '[Mock AI response]' } }],
        },
      };
    },
    async createEmbedding(_: any) {
      // Return a fixed 1536‑dimensional vector of zeros
      return { data: { embedding: Array(1536).fill(0) } };
    },
  };
}

export async function generateChatCompletion(messages: any[]) {
  const response = await openaiClient.createChatCompletion({ model: 'gpt-4', messages });
  return response.data.choices[0].message.content;
}

export async function generateEmbedding(text: string) {
  const response = await openaiClient.createEmbedding({ model: 'text-embedding-ada-002', input: text });
  return response.data.embedding;
}
