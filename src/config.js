require('dotenv').config();

module.exports = {
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.LLM_MODEL || 'gryphe/mythomax-l2-13b',
    imageModel: process.env.OPENROUTER_IMAGE_MODEL || 'google/gemma-2-9b-it:free',
  },
  stableDiffusion: {
    lora: process.env.STABLE_DIFFUSION_LORA,
  },
  database: {
    path: process.env.DATABASE_PATH || './skyrim_memory.db', // Default path, user can override
  },
  charactersToUpdate: process.env.CHARACTER_NAMES ? process.env.CHARACTER_NAMES.split(',') : [],
};
