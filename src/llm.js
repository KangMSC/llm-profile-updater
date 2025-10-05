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
    다음은 스카이림 세계의 캐릭터 '${characterName}'에 대한 기억들입니다.
    이 기억들을 바탕으로, 상세한 캐릭터 프로필을 생성해주세요.
    프로필에는 캐릭터의 성격, 최근 경험, 그리고 주요 관계가 포함되어야 합니다.

    기억들:
    ${memories.map(mem => `- ${mem.content}`).join('\n')}

    생성된 프로필:
  `;

  try {
    const response = await client.post('/chat/completions', {
      model: openRouter.model,
      messages: [
        { role: 'system', content: 'You are an AI assistant who generates character profiles based on memories. Please respond in Korean.' },
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

