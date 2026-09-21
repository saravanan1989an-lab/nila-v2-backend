export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Browser preflight request
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const { message, language } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({
      error: "Message is required",
    });
  }

  const systemPrompt =
    language === "ta"
      ? "You are Nila, a friendly AI assistant. Reply naturally in Tamil unless the user asks for another language."
      : "You are Nila, a friendly AI assistant. Reply in the same language used by the user.";

  // =====================================================
  // 1. OPENAI
  // =====================================================

  try {
    if (process.env.OPENAI_API_KEY) {
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,
          },

          body: JSON.stringify({
            model: "gpt-5.6-luna",

            instructions: systemPrompt,

            input: message,

            reasoning: {
              effort: "none",
            },
          }),
        }
      );

      if (openaiResponse.ok) {
        const data =
          await openaiResponse.json();

        let reply =
          data.output_text;

        if (!reply && data.output) {
          for (const item of data.output) {
            if (!item.content) continue;

            for (const content of item.content) {
              if (
                content.type === "output_text" &&
                content.text
              ) {
                reply = content.text;
                break;
              }
            }

            if (reply) break;
          }
        }

        if (reply) {
          return res.status(200).json({
            reply,
            provider: "openai",
          });
        }
      } else {
        const errorText =
          await openaiResponse.text();

        console.log(
          "OpenAI failed:",
          openaiResponse.status,
          errorText
        );
      }
    }
  } catch (error) {
    console.log(
      "OpenAI error:",
      error.message
    );
  }

  // =====================================================
  // 2. GEMINI
  // =====================================================

  try {
    if (process.env.GEMINI_API_KEY) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            system_instruction: {
              parts: [
                {
                  text: systemPrompt,
                },
              ],
            },

            contents: [
              {
                role: "user",

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
        const data =
          await geminiResponse.json();

        const reply =
          data?.candidates?.[0]
            ?.content?.parts
            ?.map((part) => part.text || "")
            .join("")
            .trim();

        if (reply) {
          return res.status(200).json({
            reply,
            provider: "gemini",
          });
        }
      } else {
        const errorText =
          await geminiResponse.text();

        console.log(
          "Gemini failed:",
          geminiResponse.status,
          errorText
        );
      }
    }
  } catch (error) {
    console.log(
      "Gemini error:",
      error.message
    );
  }

  // =====================================================
  // 3. GROQ
  // =====================================================

  try {
    if (process.env.GROQ_API_KEY) {
      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${process.env.GROQ_API_KEY}`,
          },

          body: JSON.stringify({
            model:
              "llama-3.3-70b-versatile",

            messages: [
              {
                role: "system",
                content: systemPrompt,
              },

              {
                role: "user",
                content: message,
              },
            ],

            temperature: 0.7,
          }),
        }
      );

      if (groqResponse.ok) {
        const data =
          await groqResponse.json();

        const reply =
          data?.choices?.[0]
            ?.message?.content;

        if (reply) {
          return res.status(200).json({
            reply,
            provider: "groq",
          });
        }
      } else {
        const errorText =
          await groqResponse.text();

        console.log(
          "Groq failed:",
          groqResponse.status,
          errorText
        );
      }
    }
  } catch (error) {
    console.log(
      "Groq error:",
      error.message
    );
  }

  // =====================================================
  // ALL FAILED
  // =====================================================

  return res.status(500).json({
    error: "All AI providers failed",
  });
          }
