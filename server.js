require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const providers = {
    openai: {
        url: "https://api.openai.com/v1/chat/completions",
        key: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL
    },

    deepseek: {
        url: "https://api.deepseek.com/chat/completions",
        key: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL
    },

    claude: {
        url: "https://api.anthropic.com/v1/messages",
        key: process.env.CLAUDE_API_KEY,
        model: process.env.CLAUDE_MODEL
    },

    grok: {
        url: "https://api.x.ai/v1/chat/completions",
        key: process.env.GROK_API_KEY,
        model: process.env.GROK_MODEL
    }
};

app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        app: "OmniAI"
    });
});

app.post("/api/chat", async (req, res) => {
    try {
        const { provider, messages } = req.body;

        if (!providers[provider]) {
            return res.status(400).json({
                error: "Unknown AI provider."
            });
        }

        if (
            !Array.isArray(messages) ||
            messages.length === 0 ||
            messages.length > 50
        ) {
            return res.status(400).json({
                error: "Invalid conversation."
            });
        }

        const valid = messages.every(m =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string" &&
            m.content.length <= 20000
        );

        if (!valid) {
            return res.status(400).json({
                error: "Invalid message format."
            });
        }

        const config = providers[provider];

        if (!config.key || !config.model) {
            return res.status(503).json({
                error: provider + " API is not configured yet."
            });
        }

        let response;

        if (provider === "claude") {
            response = await fetch(config.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": config.key,
                    "anthropic-version": "2023-06-01"
                },
                body: JSON.stringify({
                    model: config.model,
                    max_tokens: 2000,
                    messages: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                })
            });
        } else {
            response = await fetch(config.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + config.key
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: messages
                })
            });
        }

        const data = await response.json();

        if (!response.ok) {
            console.error("Provider error:", provider, data);

            return res.status(502).json({
                error: "AI provider request failed. Check your API settings."
            });
        }

        let answer;

        if (provider === "claude") {
            answer = (data.content || [])
                .filter(item => item.type === "text")
                .map(item => item.text)
                .join("\n");
        } else {
            answer = data.choices?.[0]?.message?.content;
        }

        if (!answer) {
            return res.status(502).json({
                error: "The AI returned no text."
            });
        }

        res.json({ answer });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Server error. Please try again."
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("OmniAI running on port " + PORT);
});
