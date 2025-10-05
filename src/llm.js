const axios = require('axios');
const { openRouter } = require('./config');

const client = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'Authorization': `Bearer ${openRouter.apiKey}`,
    'Content-Type': 'application/json',
  },
});

async function updateCharacterProfile(characterName, memories, existingProfileJson) {
  const prompt = `
Here is the existing JSON profile for the character '${characterName}':

\
${existingProfileJson}
\

Here are the new memories for this character since the last update:

${memories.map(mem => `- ${mem.content}`).join('\n')}

Based on these new memories, update the values for the 'summary', 'appearance', and 'likesAndDislikes' keys in the JSON profile.
If a value doesn't need changing, keep the original.
Output the complete, updated JSON object.
  `;

  try {
    const response = await client.post('/chat/completions', {
      model: openRouter.model,
      messages: [
        { role: 'system', content: 'You are an AI assistant that updates a character\'s JSON profile based on new memories. You must only output the raw, updated JSON object, and nothing else. Do not wrap the JSON in markdown ```json ... ```.' },
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
  updateCharacterProfile,
};