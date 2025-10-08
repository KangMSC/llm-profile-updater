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

async function generateCharacterDiary(characterName, events) {
  const formattedEvents = events.map(event => {
    let eventDetails = `Type: ${event.event_type}, Location: ${event.location}, Time: ${event.game_time_str}`;
    let data = event.event_data;
    try {
      const jsonData = JSON.parse(data);
      data = Object.entries(jsonData).map(([key, value]) => `${key}: ${value}`).join(', ');
    } catch (e) {
      // Not a JSON string, use as is
    }
    eventDetails += `\nDetails: ${data}`;
    return `- ${eventDetails}`;
  }).join('\n\n');

  const prompt = `
You are the character '${characterName}'. I will provide you with a sequence of events that happened to you on a specific day.
Your task is to write a personal and reflective diary entry in the first person ("I", "me", "my").
The diary should be written entirely in Korean.
Do not simply list the events. Instead, weave them into a narrative, describing your feelings, thoughts, and reactions to what happened.
The tone of the diary should reflect your personality as suggested by your actions, dialogues, and internal thoughts within the events.
The output should be only the diary entry text, formatted in Markdown.

Here are the events of your day:

${formattedEvents}

Now, write your diary entry for this day.
  `;

  try {
    const response = await client.post('/chat/completions', {
      model: openRouter.model,
      messages: [
        { role: 'system', content: 'You are a character in a video game writing a diary entry in Korean based on a list of events. You must only output the diary text in Markdown format.' },
        { role: 'user', content: prompt },
      ],
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenRouter API for diary generation:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = {
  updateCharacterProfile,
  generateCharacterDiary,
};