const axios = require('axios');
const { openRouter } = require('./config');

const client = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'Authorization': `Bearer ${openRouter.apiKey}`,
    'Content-Type': 'application/json',
  },
});

async function updateCharacterProfile(characterName, events, existingProfileJson, instructions) {
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

  // --- Global Rules ---
  const globalRules = [
    'For the fields `summary`, `interject_summary`, `personality`, `occupation`, `skills`, and `speech_style`, do not just add new text. Subtly modify the existing content only if the new events cause a significant change. Keep descriptions concise.',
    'The `background` field MUST NOT be changed. Keep its original value.',
    'Only update the `appearance` field if events explicitly mention a change in equipment (e.g., new armor) or visible physical state (e.g., injury).'
  ];

  // Programmatically add the relationship rule if no specific instruction is given
  if (!instructions || !instructions.relationships) {
    globalRules.push('The `relationships` field MUST NOT be changed. Keep its original value as no specific instructions were provided for it.');
  }

  const globalRulesString = `\n\n**GLOBAL RULES**\nYou must follow these global rules for updating the profile:\n- ${globalRules.join('\n- ')}`;

  // --- Character-Specific Instructions ---
  const instructionsString = instructions && Object.keys(instructions).length > 0
    ? `\n\n**CHARACTER-SPECIFIC INSTRUCTIONS**\nWhen updating the profile, you MUST also follow these character-specific instructions:\n${Object.entries(instructions).map(([field, instruction]) => `- For the '${field}' field: ${instruction}`).join('\n')}`
    : '';

  const prompt = `
Here is the existing JSON profile for the character '${characterName}':

\`\`\`json
${existingProfileJson}
\`\`\`

Here are the new events that have occurred to this character since the last update:

${formattedEvents}

${globalRulesString}
${instructionsString}

Based on the new events and ALL instructions provided (both global and specific), update the values for all keys in the JSON profile.
If a value doesn't need changing, keep the original.
Your task is to output the complete, updated JSON object, and nothing else.

Always respond in Korean.

The required keys are:
- summary
- interject_summary
- background
- personality
- appearance
- aspirations (must be an array of strings)
- relationships (must be an array of strings, each formatted as "Name: Description")
- occupation
- skills (must be an array of strings)
- speech_style
  `;

  try {
    const response = await client.post('/chat/completions', {
      model: openRouter.model,
      messages: [
        { role: 'system', content: 'You are an AI assistant that updates a character\'s JSON profile in Korean based on new events. You must only output the raw, updated JSON object. The JSON must contain all 10 required keys: summary, interject_summary, background, personality, appearance, aspirations (as a string array), relationships (as a string array), occupation, skills (as a string array), and speech_style. Do not wrap the JSON in markdown ```json ... ```.' },
        { role: 'user', content: prompt },
      ],
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenRouter API:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function generateCharacterDiary(characterName, events, profileJson) {
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

  const diaryDate = events[0]?.game_time_str.substring(events[0].game_time_str.indexOf(',') + 2) || 'Unknown Date';

  const profileInfo = profileJson ? `
Here is your character profile. Use this as a reference for your personality, background, and relationships when writing the diary entry:

\`\`\`json
${profileJson}
\`\`\`
` : '';

  const prompt = `
You are the character '${characterName}'. I will provide you with a sequence of events that happened to you on a specific day.
Your task is to write a personal and reflective diary entry in the first person ("I", "me", "my").
The diary should be written entirely in Korean.
Do not simply list the events. Instead, weave them into a narrative, describing your feelings, thoughts, and reactions to what happened.
The tone of the diary should reflect your personality as suggested by your actions, dialogues, and internal thoughts within the events.
${profileInfo}

**IMPORTANT FORMATTING RULES:**
1. The entire output must be a simple HTML snippet.
2. Start with a heading for the date: <h4>${diaryDate}</h4>
3. Write each paragraph of the diary inside its own <p> tag.
4. Do NOT include <html>, <body>, or <head> tags. Only output the <h4> and <p> tags.

Here are the events of your day:

${formattedEvents}

Now, write your diary entry for this day in the specified HTML format.
  `;

  try {
    const response = await client.post('/chat/completions', {
      model: openRouter.model,
      messages: [
        { role: 'system', content: 'You are a character in a video game writing a diary entry in Korean. You must only output the diary text as a raw HTML snippet, using <h4> for the title and <p> tags for paragraphs.' },
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
