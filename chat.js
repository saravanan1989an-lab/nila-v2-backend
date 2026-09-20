export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();
    const language = body.language === "en" ? "English" : "Tamil";

    if (!message) return res.status(400).json({ error: "Message is required" });

    const r = await fetch("https://api.openai.com/v1/responses", {
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
            content: [{
              type: "input_text",
              text: "You are Nila, a helpful personal assistant. Reply clearly and practically. Prefer " + language + " unless the user asks otherwise. You can help with everyday questions, automobiles, CNC basics, engineering learning, writing, and general information."
            }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: message }]
          }
        ]
      })
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "OpenAI request failed"
      });
    }

    let reply = data.output_text || "";
    if (!reply && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;
        for (const part of item.content) {
          if (part.type === "output_text" && part.text) reply += part.text;
        }
      }
    }

    return res.status(200).json({ reply: reply || "No text response returned." });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
