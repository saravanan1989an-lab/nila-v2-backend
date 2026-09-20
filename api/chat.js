export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not configured"
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});

    const message = String(body.message || "").trim();
    const language =
      body.language === "en" ? "English" : "Tamil";

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text:
                    "You are Nila, a helpful personal assistant. Reply clearly and practically. Prefer " +
                    language +
                    " unless the user asks otherwise."
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: message
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenAI request failed"
      });
    }

    let reply = "";

    if (typeof data.output_text === "string") {
      reply = data.output_text;
    }

    if (!reply && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item?.content)) {
          continue;
        }

        for (const part of item.content) {
          if (
            part?.type === "output_text" &&
            typeof part?.text === "string"
          ) {
            reply += part.text;
          }
        }
      }
    }

    return res.status(200).json({
      reply:
        reply.trim() ||
        "No text response returned."
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error"
    });
  }
}
