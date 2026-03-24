const axios = require("axios");
const { schemaPrompt } = require("../constants/schemaPrompt");

function buildPrompt(userQuery) {
  return `You are a MySQL expert.
Convert user query into SQL based on this schema:

${schemaPrompt}

Rules:
- Only return SQL
- No explanation
- Return a single SELECT query only
- Use correct joins and aliases
- Prefer explicit column names over *
- Always include a LIMIT clause (<= 200)
- Query only tables listed in schema
- Do not use data definition or write operations

User Query: ${userQuery}`;
}

function cleanSqlResponse(rawContent) {
  const cleaned = rawContent
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .trim();
  return cleaned.endsWith(";") ? cleaned.slice(0, -1) : cleaned;
}

async function callGroq(prompt) {
  const model = process.env.GROQ_MODEL || "llama-3.1-70b-versatile";
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  return response.data?.choices?.[0]?.message?.content || "";
}

async function callGemini(prompt) {
  const model = process.env.GEMINI_MODEL || "gemini-1.5-pro";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }
  );

  return (
    response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ""
  );
}

async function generateSqlFromNl(query) {
  const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();
  const prompt = buildPrompt(query);
  if (provider === "gemini" && !process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
  }
  if (provider !== "gemini" && !process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing.");
  }

  const raw = provider === "gemini" ? await callGemini(prompt) : await callGroq(prompt);
  if (!raw.trim()) {
    throw new Error("LLM returned empty SQL.");
  }
  return cleanSqlResponse(raw);
}

module.exports = {
  generateSqlFromNl,
};
