"use client";
import React, { useEffect, useRef, useState } from "react";

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [translation, setTranslation] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // 英語セグメント
  const transcriptSentences = segments.length > 0
    ? segments.map((s) => s.text)
    : transcript
      ? transcript.split(/(?<=[.!?])\s+/)
      : [];
  // 日本語訳をsegments数に必ず合わせて分割
  const translationSentences = (() => {
    if (!translation) return [];
    let arr = translation.split(/(?<=[。！？])\s*/);
    if (segments.length > 0) {
      // 必ずsegments数に合わせる
      if (arr.length < segments.length) {
        arr = arr.concat(Array(segments.length - arr.length).fill(""));
      } else if (arr.length > segments.length) {
        arr = arr.slice(0, segments.length);
      }
      return arr;
    }
    return arr;
  })();

  // 音声ファイル選択
  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
      setAudioUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  // 文字起こしテキスト選択
  const handleTranscriptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTranscriptFile(e.target.files[0]);
    }
  };

  // 文字起こしテキストのダウンロード
  const handleDownload = () => {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // アップロード処理
  const handleUpload = async () => {
    setLoading(true);
    setError("");
    let transcriptText = "";
    setSegments([]);

    try {
      // 文字起こしテキストがあればそれを使う
      if (transcriptFile) {
        const text = await transcriptFile.text();
        transcriptText = text;
        setTranscript(text);
      } else if (audioFile) {
        // なければ音声ファイルをAPIに送信
        const formData = new FormData();
        formData.append("file", audioFile);
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        transcriptText = data.transcript;
        setTranscript(data.transcript);
        if (data.segments) setSegments(data.segments);
      }

      // 翻訳API呼び出し
      if (transcriptText) {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcriptText }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setTranslation(data.translation);
      }
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    }
    setLoading(false);
  };

  // 音声再生位置に応じてハイライト（start <= current < end）
  useEffect(() => {
    if (!isPlaying || !audioRef.current || segments.length === 0) return;
    const audio = audioRef.current;
    const onTimeUpdate = () => {
      const current = audio.currentTime;
      const idx = segments.findIndex(
        (seg) => current >= seg.start && current < seg.end
      );
      setHighlightIndex(idx >= 0 ? idx : null);
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [isPlaying, segments]);

  // 再生終了時のハイライト解除
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const onEnded = () => {
      setIsPlaying(false);
      setHighlightIndex(null);
    };
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // 音声再生コントロール
  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-2">
      <div className="w-full bg-white rounded-lg shadow p-4 mt-2 mx-auto">
        <h1 className="text-2xl font-bold text-center text-blue-gray-800 mb-4 tracking-tight">音声翻訳アプリ</h1>
        <div className="flex flex-col gap-2 w-full mb-4">
          <label className="font-semibold text-gray-700 mb-1">音声ファイル（英語）</label>
          <input
            type="file"
            accept="audio/*"
            ref={audioInputRef}
            onChange={handleAudioChange}
            className="hidden"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            className="inline-block bg-blue-600 text-white font-semibold py-2 px-4 rounded shadow hover:bg-blue-700 transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            🎵 音声ファイルを選択
          </button>
          <div className="my-1" />
          <label className="font-semibold text-gray-700 mb-1">文字起こしテキストファイル（任意）</label>
          <input
            type="file"
            accept=".txt"
            ref={textInputRef}
            onChange={handleTranscriptChange}
            className="hidden"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => textInputRef.current?.click()}
            className="inline-block bg-gray-600 text-white font-semibold py-2 px-4 rounded shadow hover:bg-gray-700 transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            📄 テキストファイルを選択
          </button>
          <button
            className="mt-2 inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold shadow disabled:opacity-50 transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
            onClick={handleUpload}
            disabled={loading || (!audioFile && !transcriptFile)}
          >
            {loading ? "処理中..." : "アップロードして変換"}
          </button>
          {error && (
            <div className="mt-2 text-red-600 font-bold text-sm">{error}</div>
          )}
          {audioUrl && (
            <div className="mt-4 flex flex-col items-center w-full">
              <audio ref={audioRef} src={audioUrl} controls className="mb-2 w-full rounded shadow border border-gray-200" />
              <div className="flex gap-2">
                <button
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold shadow transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-blue-300"
                  onClick={handlePlay}
                  disabled={isPlaying}
                >
                  ▶️ 再生
                </button>
                <button
                  className="inline-block bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-semibold shadow transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-gray-300"
                  onClick={handlePause}
                  disabled={!isPlaying}
                >
                  ⏸️ 一時停止
                </button>
              </div>
            </div>
          )}
        </div>
        {/* 英語（左）・日本語（右）の2カラム領域を画面幅いっぱいに */}
        <div className="flex flex-col md:flex-row gap-2 w-full mt-2">
          {/* 左：英語 */}
          <div className="w-full md:w-1/2 bg-gray-50 p-2 rounded min-h-[120px]">
            <h2 className="font-bold mb-1 text-blue-900 text-sm">英語文字起こし</h2>
            <div className="space-y-1 text-base">
              {transcriptSentences.map((sentence, idx) => (
                <div key={idx} className="mb-1">
                  <span
                    className={
                      highlightIndex === idx && isPlaying
                        ? "bg-yellow-200 text-black font-bold px-1 rounded transition-colors shadow"
                        : ""
                    }
                  >
                    {sentence}
                  </span>
                </div>
              ))}
            </div>
            {transcript && (
              <div className="flex justify-center">
                <button
                  className="mt-2 inline-block bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded shadow font-semibold transition-colors duration-150 text-xs focus:outline-none focus:ring-2 focus:ring-green-300"
                  onClick={handleDownload}
                >
                  文字起こしをダウンロード
                </button>
              </div>
            )}
          </div>
          {/* 右：日本語訳 */}
          <div className="w-full md:w-1/2 bg-gray-50 p-2 rounded min-h-[120px]">
            <h2 className="font-bold mb-1 text-blue-900 text-sm">日本語訳</h2>
            <div className="space-y-1 text-base">
              {translationSentences.map((sentence, idx) => (
                <div key={idx} className="mb-1">
                  <span
                    className={
                      highlightIndex === idx && isPlaying
                        ? "bg-yellow-200 text-black font-bold px-1 rounded transition-colors shadow"
                        : ""
                    }
                  >
                    {sentence}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 