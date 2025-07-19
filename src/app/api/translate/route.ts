import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI APIキーが設定されていません。" },
      { status: 500 },
    );
  }

  const { text } = await req.json();
  if (!text) {
    return NextResponse.json(
      { error: "翻訳するテキストがありません。" },
      { status: 400 },
    );
  }

  const messages = [
    {
      role: "system",
      content:
        "あなたは優秀な英日翻訳者です。与えられた英語テキストを自然な日本語に翻訳してください。",
    },
    {
      role: "user",
      content: text,
    },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 2048,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error }, { status: 500 });
  }

  const data = await response.json();
  const translation = data.choices?.[0]?.message?.content || "";
  return NextResponse.json({ translation });
}
