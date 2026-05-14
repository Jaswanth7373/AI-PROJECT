require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static("."));

// Chat endpoint
app.post("/chat", async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({
                error: "Prompt is required"
            });
        }

        // STEP 1: Get real-time web search results
        const searchResponse = await axios.post(
            "https://api.tavily.com/search",
            {
                api_key: process.env.TAVILY_API_KEY,
                query: prompt,
                search_depth: "basic",
                max_results: 5
            }
        );

        // Combine search results
        const searchResults = searchResponse.data.results
            .map(result => result.content)
            .join("\n\n");

        // STEP 2: Send search data to AI model
        const aiResponse = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-3.5-turbo",

                messages: [
                    {
                        role: "system",
                        content:
                            "You are a real-time AI assistant. Answer accurately using the latest search information provided."
                    },
                    {
                        role: "user",
                        content:
                            `User Question: ${prompt}\n\nLatest Real-Time Information:\n${searchResults}`
                    }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // Extract AI response
        const reply = aiResponse.data.choices[0].message.content;

        // Send response to frontend
        res.send(reply);

    } catch (error) {
        console.error("ERROR:", error.response?.data || error.message);

        res.status(500).json({
            error:
                error.response?.data?.error?.message ||
                error.message ||
                "Failed to generate response"
        });
    }
});

// Health route
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        message: "AI Assistant Server Running"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});