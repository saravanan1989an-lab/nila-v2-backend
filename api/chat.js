export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // 1. OPENAI
  try {
    if (process.env.OPENAI_API_KEY) {
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-5.6-luna",
            input: message,
          }),
        }
      );

      if (openaiResponse.ok) {
        const data = await openaiResponse.json();

        const reply =
          data.output_text ||
          data.output
            ?.flatMap((x) => x.content || [])
            ?.find((x) => x.type === "output_text")?.text;

        if (reply) {
          return res.status(200).json({
            reply,
            provider: "openai",
          });
        }
      } else {
        console.log(
          "OpenAI failed:",
          openaiResponse.status,
          await openaiResponse.text()
        );
      }
    }
  } catch (error) {
    console.log("OpenAI error:", error.message);
  }

  // 2. GEMINI
  try {
    if (process.env.GEMINI_API_KEY) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: message,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (geminiResponse.ok) {
        const data = await geminiResponse.json();

        const reply =
          data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (reply) {
          return res.status(200).json({
            reply,
            provider: "gemini",
          });
        }
      } else {
        console.log(
          "Gemini failed:",
          geminiResponse.status,
          await geminiResponse.text()
        );
      }
    }
  } catch (error) {
    console.log("Gemini error:", error.message);
  }

  // 3. GROQ
  try {
    if (process.env.GROQ_API_KEY) {
      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content:
                  "You are Nila, a friendly AI assistant. Reply in the same language the user uses.",
              },
              {
                role: "user",
                content: message,
              },
            ],
          }),
        }
      );

      if (groqResponse.ok) {
        const data = await groqResponse.json();

        const reply =
          data?.choices?.[0]?.message?.content;

        if (reply) {
          return res.status(200).json({
            reply,
            provider: "groq",
          });
        }
      } else {
        console.log(
          "Groq failed:",
          groqResponse.status,
          await groqResponse.text()
        );
      }
    }
  } catch (error) {
    console.log("Groq error:", error.message);
  }

  return res.status(500).json({
    error: "All AI providers failed",
  });
                }
