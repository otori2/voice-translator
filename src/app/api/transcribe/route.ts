export const runtime = "nodejs";
import { Buffer } from "buffer";
import { Blob as NodeBlob, FormData as NodeFormData } from "formdata-node";
import { NextRequest, NextResponse } from "next/server";

// OpenAI設定の型定義
interface TranscribeConfig {
  apiKey: string;
  endpoint: string;
  modelName: string;
}

export async function POST(req: NextRequest) {
  // multipart/form-dataのパース
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const openaiConfigStr = formData.get("transcribeConfig") as string | null;
  
  if (!file) {
    return NextResponse.json(
      { error: "音声ファイルがありません。" },
      { status: 400 },
    );
  }

  // OpenAI設定の解析
  let openaiConfig: TranscribeConfig | undefined;
  if (openaiConfigStr) {
    try {
      openaiConfig = JSON.parse(openaiConfigStr);
    } catch (e) {
      console.warn("OpenAI設定の解析に失敗しました:", e);
    }
  }

  // 設定の優先順位: フロントエンド設定 > 環境変数 > デフォルト値
  const apiKey =
    openaiConfig?.apiKey ||
    process.env.TRANSCRIBE_API_KEY ||
    process.env.NEXT_PUBLIC_TRANSCRIBE_API_KEY ||
    process.env.OPENAI_API_KEY;
  const endpoint =
    openaiConfig?.endpoint ||
    process.env.TRANSCRIBE_ENDPOINT ||
    process.env.NEXT_PUBLIC_TRANSCRIBE_ENDPOINT ||
    process.env.ENDPOINT ||
    "https://api.openai.com";
  const modelName =
    openaiConfig?.modelName ||
    process.env.TRANSCRIBE_MODEL_NAME ||
    process.env.NEXT_PUBLIC_TRANSCRIBE_MODEL_NAME ||
    "whisper-1";
  
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI APIキーが設定されていません。" },
      { status: 500 },
    );
  }

  // FileをBufferに変換
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const form = new NodeFormData();
  form.append("file", new NodeBlob([buffer]), file.name);
  form.append("model", modelName);
  form.append("response_format", "verbose_json");

  try {
    const response = await fetch(
      `${endpoint}/v1/audio/transcriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form as unknown as BodyInit,
      },
    );

    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: text || "文字起こしAPIエラー" }, { status: 500 });
    }

    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: text || "文字起こしAPIのレスポンス解析に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({ transcript: data.text, segments: data.segments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "外部API呼び出しに失敗しました。";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
