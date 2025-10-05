require('dotenv').config();

module.exports = {
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.LLM_MODEL || 'gryphe/mythomax-l2-13b',
  },
  database: {
    path: process.env.DATABASE_PATH || './skyrim_memory.db', // Default path, user can override
  },
  charactersToUpdate: process.env.CHARACTER_NAMES ? process.env.CHARACTER_NAMES.split(',') : [],
};
