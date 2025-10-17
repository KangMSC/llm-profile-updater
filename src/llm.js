const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { openRouter, stableDiffusion } = require('./config');

const client = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'Authorization': `Bearer ${openRouter.apiKey}`,
    'Content-Type': 'application/json',
  },
});

// Helper function to read prompt files
async function getPrompt(fileName) {
  const filePath = path.join(__dirname, '..', 'prompts', fileName);
  return fs.readFile(filePath, 'utf-8');
}

// Helper function to substitute placeholders
function substitutePrompt(template, values) {
  let prompt = template;
  for (const [key, value] of Object.entries(values)) {
    prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }
  return prompt;
}

async function updateCharacterProfile(characterName, events, existingProfileJson, instructions, customKeys = []) {
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

  const rulesJson = await getPrompt('global_rules.json');
  const rules = JSON.parse(rulesJson);
  let globalRules = [...rules.base_rules];

  if (!instructions || !instructions.relationships) {
    globalRules.push(rules.relationship_rule_default);
  }

  const globalRulesString = `- ${globalRules.join('\n- ')}`;

  const instructionsString = instructions && Object.keys(instructions).length > 0
    ? `\n\n**캐릭터별 지침**\n프로필 업데이트 시, 다음 캐릭터별 지침도 반드시 따라야 합니다:\n${Object.entries(instructions).map(([field, instruction]) => `- '${field}' 필드: ${instruction}`).join('\n')}`
    : '';

  const customKeysString = customKeys && customKeys.length > 0
    ? `\n\n**사용자 정의 커스텀 필드**\n사용자가 특별히 정의한 필드: [${customKeys.join(', ')}]. 이 필드들의 내용이 창의적이고 상세하며 캐릭터의 고유한 정체성을 반영하도록 특히 주의를 기울여야 합니다.`
    : '';

  const profile = JSON.parse(existingProfileJson);
  const requiredKeys = Object.keys(profile).join('\n- ');

  const systemPromptTemplate = await getPrompt('system_update_profile.txt');
  const userPromptTemplate = await getPrompt('user_update_profile.txt');

  const userPrompt = substitutePrompt(userPromptTemplate, {
    characterName,
    existingProfileJson,
    formattedEvents,
    globalRulesString,
    instructionsString,
    customKeysString,
    requiredKeys,
  });

  try {
    const response = await client.post('/chat/completions', {
      model: openRouter.model,
      messages: [
        { role: 'system', content: systemPromptTemplate },
        { role: 'user', content: userPrompt },
      ],
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenRouter API:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function generateCharacterDiary(characterName, events, profileJson, customKeys = []) {
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

  const diaryDate = events[0]?.game_time_str.substring(events[0].game_time_str.indexOf(',') + 2) || '알 수 없는 날짜';

  const profileInfo = profileJson ? `
일기 작성 시 당신의 성격, 배경, 관계를 참고하기 위한 캐릭터 프로필입니다:

\`\`\`json
${profileJson}
\`\`\`` : '';

  const customKeysString = customKeys && customKeys.length > 0
    ? `일기 작성 시, 당신의 프로필 중 사용자가 정의한 다음 측면에 특히 주의를 기울이세요: [${customKeys.join(', ')}]. 당신의 생각과 감정이 이러한 독특한 특성을 반영하도록 하세요.`
    : '';

  const systemPromptTemplate = await getPrompt('system_generate_diary.txt');
  const userPromptTemplate = await getPrompt('user_generate_diary.txt');

  const userPrompt = substitutePrompt(userPromptTemplate, {
      characterName,
      profileInfo,
      customKeysString,
      diaryDate,
      formattedEvents
  });

  try {
    const response = await client.post('/chat/completions', {
      model: openRouter.model,
      messages: [
        { role: 'system', content: systemPromptTemplate },
        { role: 'user', content: userPrompt },
      ],
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenRouter API for diary generation:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function generateSdPrompt(profileJson) {
  const profile = JSON.parse(profileJson);

  const relevantInfo = {
    appearance: profile.appearance,
    personality: profile.personality,
    occupation: profile.occupation,
    summary: profile.summary,
  };

  const systemPromptTemplate = await getPrompt('system_generate_sd_prompt.txt');
  const userPromptTemplate = await getPrompt('user_generate_sd_prompt.txt');

  const userPrompt = substitutePrompt(userPromptTemplate, {
      relevantInfo: JSON.stringify(relevantInfo, null, 2)
  });

  try {
    const response = await client.post('/chat/completions', {
      model: openRouter.model,
      messages: [
        { role: 'system', content: systemPromptTemplate },
        { role: 'user', content: userPrompt },
      ],
    });

    let sdPrompt = response.data.choices[0].message.content;

    if (stableDiffusion.lora) {
      sdPrompt += `, <lora:${stableDiffusion.lora}:1>`;
    }

    return sdPrompt;
  } catch (error) {
    console.error('Error calling OpenRouter API for SD prompt generation:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function generateInitialProfile(characterName, userPrompt, allKeys, customKeys = []) {
  const customKeysString = customKeys && customKeys.length > 0
    ? `\n\n**사용자 정의 커스텀 필드**\n사용자가 특별히 정의한 필드: [${customKeys.join(', ')}]. 이 필드들의 내용이 창의적이고 상세하며 캐릭터의 고유한 정체성을 반영하도록 특히 주의를 기울여야 합니다.`
    : '';

  const systemPromptTemplate = await getPrompt('system_generate_initial_profile.txt');
  const userPromptTemplate = await getPrompt('user_generate_initial_profile.txt');

  const finalPrompt = substitutePrompt(userPromptTemplate, {
      characterName,
      userPrompt,
      allKeys: allKeys.join('\n- '),
      customKeysString
  });

  try {
    const response = await client.post('/chat/completions', {
      model: openRouter.model,
      messages: [
        { role: 'system', content: systemPromptTemplate },
        { role: 'user', content: finalPrompt },
      ],
    });

    let content = response.data.choices[0].message.content;

    const jsonMatch = content.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
    if (jsonMatch && jsonMatch[1]) {
      content = jsonMatch[1];
    }

    return JSON.parse(content);

  } catch (error) {
    console.error('Error calling OpenRouter API for initial profile generation:', error.response ? error.response.data : error.message);
    if (error instanceof SyntaxError) {
        console.error("Failed to parse LLM response as JSON. Raw response:", response.data.choices[0].message.content);
    }
    throw error;
  }
}

module.exports = {
  updateCharacterProfile,
  generateCharacterDiary,
  generateSdPrompt,
  generateInitialProfile,
};