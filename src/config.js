require('dotenv').config();

module.exports = {
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
  },
  database: {
    path: process.env.DATABASE_PATH || './skyrim_memory.db', // Default path, user can override
  },
};
