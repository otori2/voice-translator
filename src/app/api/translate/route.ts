import translate from "@iamtraction/google-translate";
import { NextRequest, NextResponse } from "next/server";

type TranslationEngine = "openai" | "google";

async function translateWithOpenAI(text: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI APIキーが設定されていません。");
  }

  const input = `あなたは優秀な英日翻訳者です。与えられた英語テキストを自然な日本語に翻訳してください。\n\n${text}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI APIエラー: ${error}`);
  }

  const data = await response.json();
  return data.output_text || (Array.isArray(data.output) && data.output[0]?.content?.[0]?.text) || '';
}

async function translateWithGoogle(text: string) {
  const res = await translate(text, { from: "en", to: "ja" });
  return res.text;
}

export async function POST(req: NextRequest) {
  try {
    const { text, engine = "openai" } = (await req.json()) as {
      text: string;
      engine?: TranslationEngine;
    };

    if (!text) {
      return NextResponse.json(
        { error: "翻訳するテキストがありません。" },
        { status: 400 },
      );
    }

    let translation = "";
    if (engine === "google") {
      translation = await translateWithGoogle(text);
    } else {
      translation = await translateWithOpenAI(text);
    }

    return NextResponse.json({ translation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "翻訳中に不明なエラーが発生しました。";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
