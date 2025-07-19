"use client";
import React, { useEffect, useRef, useState } from "react";

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  ja?: string;
}

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [translation, setTranslation] = useState<string>("");
  const [loading, setLoading] = useState<false | "transcribe" | "translate">(
    false,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // 英語セグメント
  const transcriptSentences =
    segments.length > 0
      ? segments.map((s) => s.text)
      : transcript
        ? transcript.split(/(?<=[.!?])\s+/)
        : [];
  // 日本語訳をsegments数に必ず合わせて分割
  const translationSentences =
    segments.length > 0
      ? segments.map((s) => s.ja || "")
      : (() => {
          if (!translation) return [];
          let arr = translation.split(/(?<=[。！？])\s*/);
          if (segments.length > 0) {
            if (arr.length < segments.length) {
              arr = arr.concat(Array(segments.length - arr.length).fill(""));
            } else if (arr.length > segments.length) {
              arr = arr.slice(0, segments.length);
            }
            return arr;
          }
          return arr;
        })();

  // 最大行数をsegments数または両配列の長い方に合わせる
  const maxLines = Math.max(
    transcriptSentences.length,
    translationSentences.length,
  );

  // 音声ファイル選択
  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
      setAudioUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  // 文字起こしテキストのダウンロード（TSV形式: start\tend\ttext\tja）
  const handleDownload = () => {
    let content = "";
    if (segments.length > 0) {
      content = segments
        .map((seg) => `${seg.start}\t${seg.end}\t${seg.text}\t${seg.ja || ""}`)
        .join("\n");
    } else if (transcript) {
      content = transcript;
    }
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 文字起こしテキスト選択（TSV形式ならsegments復元）
  const handleTranscriptChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files[0]) {
      setTranscriptFile(e.target.files[0]);
      const text = await e.target.files[0].text();
      // TSV形式判定
      const lines = text.split(/\r?\n/);
      let transcriptText = "";
      if (lines.length > 0 && lines[0].split("\t").length >= 3) {
        // segments復元
        const segs = lines.map((line, idx) => {
          const cols = line.split("\t");
          return {
            id: idx,
            start: parseFloat(cols[0]),
            end: parseFloat(cols[1]),
            text: cols[2],
            ja: cols[3] || "",
          };
        });
        setSegments(segs);
        transcriptText = segs.map((s) => s.text).join(" ");
        setTranscript(transcriptText);
        // jaが全て空なら自動翻訳
        if (segs.some((s) => !s.ja)) {
          await translateSegments(segs);
        } else {
          setTranslation(segs.map((s) => s.ja).join(" "));
        }
      } else {
        // 旧形式
        setSegments([]);
        transcriptText = text;
        setTranscript(text);
        // 自動で翻訳API呼び出し
        if (transcriptText) {
          setLoading("translate");
          setError("");
          try {
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: transcriptText }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setTranslation(data.translation);
          } catch (e: any) {
            setError(e.message || "エラーが発生しました");
          }
          setLoading(false);
        }
      }
    }
  };

  // セグメントごとに翻訳する関数
  const translateSegments = async (segs: Segment[]) => {
    setLoading("translate");
    setError("");
    const newSegs = [...segs];
    for (let i = 0; i < newSegs.length; i++) {
      if (newSegs[i].ja && newSegs[i].ja.length > 0) continue;
      try {
        // 1文ずつ翻訳
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: newSegs[i].text }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        newSegs[i].ja = data.translation;
        setSegments([...newSegs]); // 進捗表示のため都度更新
      } catch (e: any) {
        setError(e.message || "エラーが発生しました");
        break;
      }
    }
    setSegments([...newSegs]);
    setTranslation(newSegs.map((s) => s.ja).join(" "));
    setLoading(false);
  };

  // アップロード処理
  const handleUpload = async () => {
    setLoading("transcribe");
    setError("");
    let transcriptText = "";
    setSegments([]);

    try {
      // 文字起こしテキストがあればそれを使う
      if (transcriptFile) {
        const text = await transcriptFile.text();
        transcriptText = text;
        setTranscript(text);
        setLoading("translate");
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
        if (data.segments) {
          setSegments(data.segments);
          await translateSegments(data.segments);
          return;
        }
        setLoading("translate");
      }

      // transcriptTextがあれば一括翻訳
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
        (seg) => current >= seg.start && current < seg.end,
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
      {/* ローディング表示 */}
      {loading && (
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
          <span className="text-blue-700 font-semibold text-base">
            {loading === "transcribe" ? "文字起こし中..." : "翻訳中..."}
          </span>
        </div>
      )}
      <div className="w-full bg-white rounded-lg shadow p-4 mt-2 mx-auto">
        <h1 className="text-2xl font-bold text-center text-blue-gray-800 mb-4 tracking-tight">
          音声翻訳アプリ
        </h1>
        <div className="w-full mb-4">
          <div className="grid grid-cols-3 gap-4 items-center justify-items-center">
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="bg-blue-200 text-blue-900 font-semibold py-2 px-3 rounded shadow hover:bg-blue-300 transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-blue-100 w-full"
            >
              🎵 音声ファイルを選択
            </button>
            <button
              type="button"
              onClick={() => textInputRef.current?.click()}
              className="bg-gray-200 text-gray-800 font-semibold py-2 px-3 rounded shadow hover:bg-gray-300 transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-gray-100 w-full"
            >
              📄 テキストファイルを選択
            </button>
            <button
              className="bg-rose-200 hover:bg-rose-300 text-rose-900 px-4 py-2 rounded font-semibold shadow disabled:opacity-50 transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-rose-100 w-full"
              onClick={handleUpload}
              disabled={loading || (!audioFile && !transcriptFile)}
            >
              {loading ? "処理中..." : "文字起こし&翻訳実行"}
            </button>
            <div className="text-xs text-gray-600 text-center min-h-[1.5em] w-full">
              {audioFile?.name || ""}
            </div>
            <div className="text-xs text-gray-600 text-center min-h-[1.5em] w-full">
              {transcriptFile?.name || ""}
            </div>
            <div></div>
          </div>
          <input
            type="file"
            accept="audio/*"
            ref={audioInputRef}
            onChange={handleAudioChange}
            className="hidden"
            style={{ display: "none" }}
          />
          <input
            type="file"
            accept=".txt"
            ref={textInputRef}
            onChange={handleTranscriptChange}
            className="hidden"
            style={{ display: "none" }}
          />
        </div>
        {error && (
          <div className="mt-2 text-red-600 font-bold text-sm">{error}</div>
        )}
        {audioUrl && (
          <div className="mt-4 flex flex-col items-center w-full">
            <audio
              ref={audioRef}
              src={audioUrl}
              controls
              className="mb-2 w-full rounded shadow border border-gray-200"
            />
            <div className="flex gap-2">
              <button
                className="inline-block bg-blue-200 hover:bg-blue-300 text-blue-900 px-4 py-2 rounded font-semibold shadow transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-blue-100"
                onClick={handlePlay}
                disabled={isPlaying}
              >
                ▶️ 再生
              </button>
              <button
                className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded font-semibold shadow transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-gray-100"
                onClick={handlePause}
                disabled={!isPlaying}
              >
                ⏸️ 一時停止
              </button>
              <button
                className="inline-block bg-green-200 hover:bg-green-300 text-green-900 px-4 py-2 rounded shadow font-semibold transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-green-100 disabled:opacity-50"
                onClick={handleDownload}
                disabled={loading || segments.length === 0}
              >
                文字起こしをダウンロード
              </button>
            </div>
          </div>
        )}
        {/* 英語・日本語の見出し */}
        {(transcriptSentences.length > 0 || translationSentences.length > 0) && (
          <div className="w-full flex flex-row border-b border-gray-300 mt-6 mb-1">
            <div className="w-1/2 pr-2 text-center font-bold text-blue-900 text-base">英語</div>
            <div className="w-1/2 pl-2 text-center font-bold text-blue-900 text-base">日本語訳</div>
          </div>
        )}
        {/* 英語・日本語を1行ペアで横並び表示 */}
        <div className="w-full mt-2">
          <div className="flex flex-col w-full">
            {[...Array(maxLines)].map((_, idx) => (
              <div
                key={idx}
                className="flex flex-row w-full border-b border-gray-200 py-1 items-center"
              >
                <div
                  className={`w-1/2 pr-2 ${highlightIndex === idx && isPlaying ? 'bg-yellow-100 text-black font-bold rounded transition-colors shadow' : ''}`}
                >
                  {transcriptSentences[idx] || ''}
                </div>
                <div className={`w-1/2 pl-2 ${highlightIndex === idx && isPlaying ? 'bg-yellow-100 text-black font-bold rounded transition-colors shadow' : ''}`}>
                  {translationSentences[idx] || ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
