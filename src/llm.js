const axios = require('axios');
const { openRouter } = require('./config');

const client = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'Authorization': `Bearer ${openRouter.apiKey}`,
    'Content-Type': 'application/json',
  },
});

async function generateCharacterProfile(characterName, memories) {
  const prompt = `
    The following are memories for a character named ${characterName} from the world of Skyrim.
    Based on these memories, generate a detailed character profile.
    The profile should describe their personality, recent experiences, and key relationships.

    Memories:
    ${memories.map(mem => `- ${mem.memory_text}`).join('\n')}

    Generated Profile:
  `;

  try {
    const response = await client.post('/chat/completions', {
      model: 'gryphe/mythomax-l2-13b', // A good default model on OpenRouter
      messages: [
        { role: 'user', content: prompt },
      ],
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenRouter API:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = {
  generateCharacterProfile,
};

