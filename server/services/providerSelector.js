function getChatProvider() {
  return 'groq';
}

function getEmbeddingProvider() {
  return 'gemini';
}

module.exports = {
  getChatProvider,
  getEmbeddingProvider
};