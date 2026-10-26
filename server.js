const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const providers = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: "GROQ_API_KEY",
    model: "GROQ_MODEL"
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    key: "OPENAI_API_KEY",
    model: "OPENAI_MODEL"
  },
  deepseek: {
    url: "https://api.deepseek.com/chat/completions",
    key: "DEEPSEEK_API_KEY",
    model: "DEEPSEEK_MODEL"
  },
  grok: {
    url: "https://api.x.ai/v1/chat/completions",
    key: "GROK_API_KEY",
    model: "GROK_MODEL"
  }
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "OmniAI" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const providerName = String(
      req.body.provider || req.body.modelProvider || "groq"
    ).toLowerCase();

    const config = providers[providerName];

    if (!config) {
      return res.status(400).json({
        error: "Unsupported AI provider. Please select Groq."
      });
    }

    const apiKey = process.env[config.key];
    const model = process.env[config.model];

    if (!apiKey || !model) {
      return res.status(503).json({
        error: `${providerName} API is not configured. Check your Render environment variables.`
      });
    }

    const messages = req.body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please provide a message."
      });
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: messages.map((message) => ({
          role: ["system", "user", "assistant"].includes(message.role)
            ? message.role
            : "user",
          content: String(message.content || "")
        })),
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        `${providerName} API error:`,
        response.status,
        data
      );

      return res.status(response.status).json({
        error: data.error?.message ||
          `${providerName} request failed. Check your API key, model and usage limits.`
      });
    }

    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(502).json({
        error: "The AI provider returned an empty response."
      });
    }

    res.json({ answer });
  } catch (error) {
    console.error("Chat error:", error.message);

    res.status(500).json({
      error: "Unable to contact the AI provider. Please try again."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OmniAI server running on port ${PORT}`);
});
