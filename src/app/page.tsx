"use client";
import React, { useEffect, useRef, useState } from "react";

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  ja?: string;
}

type TranslationEngine = "openai" | "google" | "ollama";

// fetchの戻り値型を明示
interface TranslateResponse { translation: string; error?: string; }
interface TranscribeResponse { transcript: string; segments?: Segment[]; error?: string; }

// 設定の型定義
interface TranscribeConfig {
  apiKey: string;
  endpoint: string;
  modelName: string;
}

interface TranslateOpenAIConfig {
  apiKey: string;
  endpoint: string;
  modelName: string;
}

interface TranslateOllamaConfig {
  endpoint: string;
  modelName: string;
  apiKey?: string;
}

const safeJsonParse = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || "APIから空のレスポンスを受信しました。");
  }
};

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  // 動画用の状態を追加
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [translation, setTranslation] = useState<string>("");
  const [translationEngine, setTranslationEngine] =
    useState<TranslationEngine>("openai");
  const [loading, setLoading] = useState<false | "transcribe" | "translate">(
    false,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  
  // 設定パネルの状態
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [transcribeConfig, setTranscribeConfig] = useState<TranscribeConfig>({
    apiKey: "",
    endpoint: "https://api.openai.com",
    modelName: "whisper-1"
  });
  const [translateOpenAIConfig, setTranslateOpenAIConfig] = useState<TranslateOpenAIConfig>({
    apiKey: "",
    endpoint: "https://api.openai.com",
    modelName: "gpt-5-nano"
  });
  const [translateOllamaConfig, setTranslateOllamaConfig] = useState<TranslateOllamaConfig>({
    endpoint: "http://localhost:11434",
    modelName: "llama3.1:8b",
    apiKey: ""
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null); // 動画用ref
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const sentenceRefs = useRef<(HTMLDivElement | null)[]>([]);

  // セッションストレージから設定を読み込み、環境変数の値をデフォルトとして設定
  useEffect(() => {
    // 文字起こし設定
    const savedTranscribe = sessionStorage.getItem("transcribe-config");
    if (savedTranscribe) {
      setTranscribeConfig(JSON.parse(savedTranscribe));
    } else {
      const defaultTranscribe = {
        apiKey: process.env.NEXT_PUBLIC_TRANSCRIBE_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || "",
        endpoint: process.env.NEXT_PUBLIC_TRANSCRIBE_ENDPOINT || process.env.NEXT_PUBLIC_ENDPOINT || "https://api.openai.com",
        modelName: process.env.NEXT_PUBLIC_TRANSCRIBE_MODEL_NAME || "whisper-1",
      };
      setTranscribeConfig(defaultTranscribe);
      sessionStorage.setItem("transcribe-config", JSON.stringify(defaultTranscribe));
    }

    // 翻訳(OpenAI/互換)設定
    const savedTranslateOpenAI = sessionStorage.getItem("translate-openai-config");
    if (savedTranslateOpenAI) {
      setTranslateOpenAIConfig(JSON.parse(savedTranslateOpenAI));
    } else {
      const defaultOpenAI = {
        apiKey: process.env.NEXT_PUBLIC_TRANSLATE_OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || "",
        endpoint: process.env.NEXT_PUBLIC_TRANSLATE_OPENAI_ENDPOINT || process.env.NEXT_PUBLIC_ENDPOINT || "https://api.openai.com",
        modelName: process.env.NEXT_PUBLIC_TRANSLATE_OPENAI_MODEL_NAME || process.env.NEXT_PUBLIC_MODEL_NAME || "gpt-5-nano",
      };
      setTranslateOpenAIConfig(defaultOpenAI);
      sessionStorage.setItem("translate-openai-config", JSON.stringify(defaultOpenAI));
    }

    // 翻訳(Ollama)設定
    const savedTranslateOllama = sessionStorage.getItem("translate-ollama-config");
    if (savedTranslateOllama) {
      setTranslateOllamaConfig(JSON.parse(savedTranslateOllama));
    } else {
      const defaultOllama = {
        endpoint: process.env.NEXT_PUBLIC_TRANSLATE_OLLAMA_ENDPOINT || "http://localhost:11434",
        modelName: process.env.NEXT_PUBLIC_TRANSLATE_OLLAMA_MODEL_NAME || "llama3.1:8b",
        apiKey: process.env.NEXT_PUBLIC_TRANSLATE_OLLAMA_API_KEY || "",
      };
      setTranslateOllamaConfig(defaultOllama);
      sessionStorage.setItem("translate-ollama-config", JSON.stringify(defaultOllama));
    }
  }, []);

  // 設定パネル外クリックでパネルを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isSettingsOpen && !target.closest('.settings-panel') && !target.closest('.hamburger-button')) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  // 設定変更時にセッションストレージに保存
  const updateTranscribeConfig = (newConfig: Partial<TranscribeConfig>) => {
    const updated = { ...transcribeConfig, ...newConfig };
    setTranscribeConfig(updated);
    sessionStorage.setItem("transcribe-config", JSON.stringify(updated));
  };
  const resetTranscribeConfig = () => {
    const defaults = {
      apiKey: "",
      endpoint: "https://api.openai.com",
      modelName: "whisper-1",
    };
    setTranscribeConfig(defaults);
    sessionStorage.setItem("transcribe-config", JSON.stringify(defaults));
  };

  const updateTranslateOpenAIConfig = (newConfig: Partial<TranslateOpenAIConfig>) => {
    const updated = { ...translateOpenAIConfig, ...newConfig };
    setTranslateOpenAIConfig(updated);
    sessionStorage.setItem("translate-openai-config", JSON.stringify(updated));
  };
  const resetTranslateOpenAIConfig = () => {
    const defaults = {
      apiKey: "",
      endpoint: "https://api.openai.com",
      modelName: "gpt-5-nano",
    };
    setTranslateOpenAIConfig(defaults);
    sessionStorage.setItem("translate-openai-config", JSON.stringify(defaults));
  };

  const updateTranslateOllamaConfig = (newConfig: Partial<TranslateOllamaConfig>) => {
    const updated = { ...translateOllamaConfig, ...newConfig };
    setTranslateOllamaConfig(updated);
    sessionStorage.setItem("translate-ollama-config", JSON.stringify(updated));
  };
  const resetTranslateOllamaConfig = () => {
    const defaults = {
      endpoint: "http://localhost:11434",
      modelName: "llama3.1:8b",
      apiKey: "",
    };
    setTranslateOllamaConfig(defaults);
    sessionStorage.setItem("translate-ollama-config", JSON.stringify(defaults));
  };

  const resetAllConfigs = () => {
    resetTranscribeConfig();
    resetTranslateOpenAIConfig();
    resetTranslateOllamaConfig();
  };

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

  // 音声・動画ファイル選択
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      // 拡張子で動画か音声か判定
      if (file.type.startsWith("video/")) {
        setVideoFile(file);
        setVideoUrl(url);
        setAudioFile(null);
        setAudioUrl("");
      } else if (file.type.startsWith("audio/")) {
        setAudioFile(file);
        setAudioUrl(url);
        setVideoFile(null);
        setVideoUrl("");
      }
    }
  };

  // 文字起こしテキストのダウンロード（TSV形式: start\tend\ttext\tja）
  const handleDownload = () => {
    let content = '';
    if (segments.length > 0) {
      content = segments.map(seg => `${seg.start}\t${seg.end}\t${seg.text}\t${seg.ja || ''}`).join('\n');
    } else if (transcript) {
      content = transcript;
    }
    // 音声ファイル名をベースに拡張子だけ.txtに
    let filename = 'transcript.txt';
    if (audioFile?.name) {
      filename = audioFile.name.replace(/\.[^.]+$/, '') + '.txt';
    }
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 文字起こしテキスト選択（TSV形式ならsegments復元）
  const handleTranscriptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTranscriptFile(e.target.files[0]);
      const text = await e.target.files[0].text();
      // TSV形式判定
      const lines = text.split(/\r?\n/);
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
        setTranscript(segs.map((s) => s.text).join(" "));
        setTranslation(segs.map((s) => s.ja).join(" "));
      } else {
        // 旧形式
        setSegments([]);
        setTranscript(text);
        setTranslation("");
      }
    }
  };

  // セグメントごとに翻訳する関数
  const translateSegments = async (segs: Segment[]) => {
    setLoading("translate");
    setError("");
    const newSegs = [...segs];
    for (let i = 0; i < newSegs.length; i++) {
      const segment = newSegs[i];
      if (!segment) continue;
      if (segment.ja && segment.ja.length > 0) continue;
      try {
        // 1文ずつ翻訳
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: segment.text,
            engine: translationEngine,
            openaiConfig: translateOpenAIConfig,
            ollamaConfig: translateOllamaConfig,
          }),
        });
        const data: TranslateResponse = await safeJsonParse(res);
        if (data.error) throw new Error(data.error);
        segment.ja = data.translation;
        setSegments([...newSegs]); // 進捗表示のため都度更新
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
        break;
      }
    }
    setSegments([...newSegs]);
    setTranslation(newSegs.map((s) => s.ja).join(" "));
    setLoading(false);
  };

  // handleUploadの修正: 動画ファイルにも対応
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
      } else if (audioFile || videoFile) {
        // 音声または動画ファイルをAPIに送信
        const formData = new FormData();
        if (audioFile) formData.append("file", audioFile);
        if (videoFile) formData.append("file", videoFile);
        formData.append("transcribeConfig", JSON.stringify(transcribeConfig)); // 設定を送信
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const data: TranscribeResponse = await safeJsonParse(res);
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
          body: JSON.stringify({
            text: transcriptText,
            engine: translationEngine,
            openaiConfig: translateOpenAIConfig,
            ollamaConfig: translateOllamaConfig,
          }),
        });
        const data: TranslateResponse = await safeJsonParse(res);
        if (data.error) throw new Error(data.error);
        setTranslation(data.translation);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
    setLoading(false);
  };

  // 再生位置に応じてハイライト（audio/video両対応）
  useEffect(() => {
    if (!isPlaying || segments.length === 0) return;
    const audio = audioRef.current;
    const video = videoRef.current;
    const getCurrent = () => {
      if (audio && !videoUrl) return audio.currentTime;
      if (video && videoUrl) return video.currentTime;
      return 0;
    };
    const onTimeUpdate = () => {
      const current = getCurrent();
      const idx = segments.findIndex(
        (seg) => current >= seg.start && current < seg.end,
      );
      setHighlightIndex(idx >= 0 ? idx : null);
    };
    if (audio && !videoUrl) {
      audio.addEventListener("timeupdate", onTimeUpdate);
      return () => {
        audio.removeEventListener("timeupdate", onTimeUpdate);
      };
    } else if (video && videoUrl) {
      video.addEventListener("timeupdate", onTimeUpdate);
      return () => {
        video.removeEventListener("timeupdate", onTimeUpdate);
      };
    }
  }, [isPlaying, segments, videoUrl]);

  // 再生終了時のハイライト解除（audio/video両対応）
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    const onEnded = () => {
      setIsPlaying(false);
      setHighlightIndex(null);
    };
    if (audio && !videoUrl) {
      audio.addEventListener("ended", onEnded);
      return () => {
        audio.removeEventListener("ended", onEnded);
      };
    } else if (video && videoUrl) {
      video.addEventListener("ended", onEnded);
      return () => {
        video.removeEventListener("ended", onEnded);
      };
    }
  }, [videoUrl]);

  // 自動スクロール
  useEffect(() => {
    if (
      highlightIndex !== null &&
      typeof highlightIndex !== 'undefined' &&
      highlightIndex >= 0 &&
      highlightIndex < sentenceRefs.current.length &&
      sentenceRefs.current[highlightIndex]
    ) {
      sentenceRefs.current[highlightIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightIndex]);

  // 再生コントロール（audio/video両対応）
  const handlePlay = () => {
    if (videoUrl && videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    } else if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (videoUrl && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // クリアボタン処理
  const handleClear = () => {
    setAudioFile(null);
    setAudioUrl("");
    setVideoFile(null);
    setVideoUrl("");
    setTranscriptFile(null);
    setTranscript("");
    setSegments([]);
    setTranslation("");
    setHighlightIndex(null);
    setError("");
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    // input[type=file]のvalueもリセット
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (textInputRef.current) textInputRef.current.value = "";
  };

  return (
    <main className="h-screen flex flex-col items-center justify-center bg-gray-100 p-2">
      <div className="w-full bg-white rounded-lg shadow p-4 mt-2 mx-auto flex flex-col h-[95vh]">
        {/* ---- ヘッダー部分 (固定) ---- */}
        <div className="flex-shrink-0">
          <div className="flex flex-row items-center justify-center mb-4 relative">
            <h1 className="text-2xl font-bold text-blue-gray-800 tracking-tight mx-auto">
              音声・動画翻訳アプリ
            </h1>
            
            {/* ハンバーガーメニュー */}
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="hamburger-button absolute right-0 top-0 p-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {loading && (
              <div className="flex items-center gap-2 ml-4 absolute right-12">
                <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                <span className="text-blue-700 font-semibold text-base">
                  {loading === "transcribe" ? "文字起こし中..." : "翻訳中..."}
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-center mb-4 space-x-4 flex-wrap">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="translationEngine"
                value="openai"
                checked={translationEngine === "openai"}
                onChange={() => setTranslationEngine("openai")}
                className="form-radio h-4 w-4 text-blue-600"
              />
              <span className="text-gray-700">OpenAI互換 (高精度)</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="translationEngine"
                value="ollama"
                checked={translationEngine === "ollama"}
                onChange={() => setTranslationEngine("ollama")}
                className="form-radio h-4 w-4 text-orange-600"
              />
              <span className="text-gray-700">Ollama (ローカル)</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="translationEngine"
                value="google"
                checked={translationEngine === "google"}
                onChange={() => setTranslationEngine("google")}
                className="form-radio h-4 w-4 text-green-600"
              />
              <span className="text-gray-700">Google翻訳 (高速･無料)</span>
            </label>
          </div>
          <div className="w-full mb-4">
            <div className="grid grid-cols-4 gap-4 items-center justify-items-center">
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="bg-blue-200 text-blue-900 font-semibold py-2 px-3 rounded shadow hover:bg-blue-300 transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-blue-100 w-full"
              >
                🎵 音声/動画ファイルを選択
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
                disabled={!!loading || (!audioFile && !transcriptFile) || !!videoFile}
              >
                {loading ? "処理中..." : "文字起こし&翻訳実行"}
              </button>
              <button
                className="bg-yellow-200 hover:bg-yellow-300 text-yellow-900 px-4 py-2 rounded font-semibold shadow transition-colors duration-150 text-base focus:outline-none focus:ring-2 focus:ring-yellow-100 w-full"
                onClick={handleClear}
                disabled={!!loading}
              >
                🧹 クリア
              </button>
              <div className="text-xs text-gray-600 text-center min-h-[1.5em] w-full">
                {audioFile?.name || videoFile?.name || ""}
              </div>
              <div className="text-xs text-gray-600 text-center min-h-[1.5em] w-full">
                {transcriptFile?.name || ""}
              </div>
              <div></div>
              <div></div>
            </div>
            <input
              type="file"
              accept="audio/*,video/*"
              ref={audioInputRef}
              onChange={handleMediaChange}
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
          {audioUrl && !videoUrl && (
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
                  disabled={!!loading || segments.length === 0}
                >
                  文字起こしをダウンロード
                </button>
              </div>
            </div>
          )}
          {videoUrl && (
            <div className="mt-4 flex flex-col items-center w-full">
              <div className="flex justify-center items-center w-full" style={{ minHeight: "200px" }}>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="mb-2"
                  style={{ maxHeight: "360px", maxWidth: "100%", height: "auto", width: "auto", display: "block" }}
                />
              </div>
              <div className="flex gap-2 mt-2">
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
                  disabled={!!loading || segments.length === 0}
                >
                  文字起こしをダウンロード
                </button>
              </div>
            </div>
          )}
          {(transcriptSentences.length > 0 || translationSentences.length > 0) && (
            <div className="w-full flex flex-row border-b border-gray-300 mt-6 mb-1">
              <div className="w-1/2 pr-2 text-center font-bold text-blue-900 text-base">英語</div>
              <div className="w-1/2 pl-2 text-center font-bold text-blue-900 text-base">日本語訳</div>
            </div>
          )}
        </div>
        {/* ---- コンテンツ部分 (スクロール) ---- */}
        <div className="w-full mt-2 flex-grow overflow-y-auto">
          <div className="flex flex-col w-full">
            {[...Array(maxLines)].map((_, idx) => (
              <div 
                key={idx} 
                ref={(el: HTMLDivElement | null) => { sentenceRefs.current[idx] = el; }}
                className="flex flex-row w-full border-b border-gray-200 py-1 items-center"
              >
                <div
                  className={`w-1/2 pr-2 ${highlightIndex === idx && isPlaying ? 'bg-yellow-100 text-black font-bold rounded transition-colors shadow' : ''} ${segments[idx] ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                  onClick={() => {
                    if (segments[idx]) {
                      if (videoUrl && videoRef.current) {
                        videoRef.current.currentTime = segments[idx].start;
                        videoRef.current.play();
                        setIsPlaying(true);
                      } else if (audioRef.current) {
                        audioRef.current.currentTime = segments[idx].start;
                        audioRef.current.play();
                        setIsPlaying(true);
                      }
                    }
                  }}
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
      
      {/* 設定パネル（右側スライド） */}
      <div className={`settings-panel fixed top-0 right-0 h-full w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${isSettingsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* ヘッダー */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">設定</h2>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* 設定フォーム */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-8">
              {/* 文字起こし設定 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">文字起こし (OpenAI互換 Whisper)</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    APIキー
                  </label>
                  <input
                    type="password"
                    value={transcribeConfig.apiKey}
                    onChange={(e) => updateTranscribeConfig({ apiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    エンドポイント
                  </label>
                  <input
                    type="url"
                    value={transcribeConfig.endpoint}
                    onChange={(e) => updateTranscribeConfig({ endpoint: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.openai.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    モデル名
                  </label>
                  <input
                    type="text"
                    value={transcribeConfig.modelName}
                    onChange={(e) => updateTranscribeConfig({ modelName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="whisper-1"
                  />
                </div>
              </div>

              {/* 翻訳(OpenAI互換) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">翻訳 (OpenAI互換)</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    APIキー
                  </label>
                  <input
                    type="password"
                    value={translateOpenAIConfig.apiKey}
                    onChange={(e) => updateTranslateOpenAIConfig({ apiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    エンドポイント
                  </label>
                  <input
                    type="url"
                    value={translateOpenAIConfig.endpoint}
                    onChange={(e) => updateTranslateOpenAIConfig({ endpoint: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.openai.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    モデル名
                  </label>
                  <input
                    type="text"
                    value={translateOpenAIConfig.modelName}
                    onChange={(e) => updateTranslateOpenAIConfig({ modelName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="gpt-4.1-mini"
                  />
                </div>
              </div>

              {/* 翻訳(Ollama) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">翻訳 (Ollama)</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    エンドポイント
                  </label>
                  <input
                    type="url"
                    value={translateOllamaConfig.endpoint}
                    onChange={(e) => updateTranslateOllamaConfig({ endpoint: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    モデル名
                  </label>
                  <input
                    type="text"
                    value={translateOllamaConfig.modelName}
                    onChange={(e) => updateTranslateOllamaConfig({ modelName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="llama3.1:8b"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    APIキー (任意・プロキシ利用時)
                  </label>
                  <input
                    type="password"
                    value={translateOllamaConfig.apiKey || ""}
                    onChange={(e) => updateTranslateOllamaConfig({ apiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(通常は不要)"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* フッター */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex justify-between">
              <button
                onClick={resetAllConfigs}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                全てリセット
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* オーバーレイ */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-25 z-40" onClick={() => setIsSettingsOpen(false)}></div>
      )}
    </main>
  );
}
