const OpenAI = require('openai');
require('dotenv').config();

const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
  maxRetries: 3,
  timeout: 60000,
  defaultHeaders: {
    'User-Agent': 'RepoResume-Server/1.0',
  }
});

// Helper for delay
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// Fallback logic for AI models
async function callAI(messages, options = {}) {
  const { 
    model = "meta/llama-3.3-70b-instruct", 
    response_format = undefined,
    stream = false,
    extra_body = {},
    fallbacks = ["meta/llama-3.1-405b-instruct", "mistralai/mixtral-8x7b-instruct-v0.1"],
    apiKey = null
  } = options;

  const client = apiKey ? new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://integrate.api.nvidia.com/v1',
    maxRetries: 3,
    timeout: 60000,
    defaultHeaders: { 'User-Agent': 'RepoResume-Server/1.0' }
  }) : nvidia;

  let currentModel = model;
  let attempts = 0;
  const maxAttempts = fallbacks.length + 1;

  while (attempts < maxAttempts) {
    try {
      console.log(`[AI CALL] Attempt ${attempts + 1} with ${currentModel}`);
      const completion = await client.chat.completions.create({
        model: currentModel,
        messages: messages,
        response_format: response_format,
        stream: stream,
        ...extra_body
      });
      return completion;
    } catch (error) {
      console.error(`[AI ERROR] ${currentModel} failed:`, error.message);
      if (attempts < fallbacks.length) {
        currentModel = fallbacks[attempts];
        attempts++;
        console.log(`[AI RETRY] Waiting 2s before fallback to ${currentModel}...`);
        await delay(2000); 
      } else {
        throw error;
      }
    }
  }
}

module.exports = { callAI, nvidia };
