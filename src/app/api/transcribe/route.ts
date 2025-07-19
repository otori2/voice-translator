export const runtime = 'nodejs';
import { Buffer } from 'buffer';
import { Blob as NodeBlob, FormData as NodeFormData } from 'formdata-node';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI APIキーが設定されていません。' }, { status: 500 });
  }

  // multipart/form-dataのパース
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: '音声ファイルがありません。' }, { status: 400 });
  }

  // FileをBufferに変換
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const form = new NodeFormData();
  form.append('file', new NodeBlob([buffer]), file.name);
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: form as unknown as BodyInit,
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error }, { status: 500 });
  }

  const data = await response.json();
  console.log('Whisper response:', data); // デバッグ用
  // transcript: 全文, segments: セグメント配列
  return NextResponse.json({ transcript: data.text, segments: data.segments });
} 