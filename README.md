# 音声翻訳アプリ

このアプリは、**英語音声ファイルのアップロード・自動文字起こし・日本語翻訳**を行い、 再生と同時に英語・日本語の対応テキストをハイライト表示できるWebアプリです。

## 主な機能

- 英語音声ファイルのアップロードと自動文字起こし（OpenAI Whisper利用）
- 英文テキストの日本語翻訳（OpenAI GPTまたはGoogle翻訳を選択可能）
- 音声再生に合わせた英語・日本語テキストの同期ハイライト表示
- 文字起こし・翻訳結果のTSV形式ダウンロード／アップロード
- OpenAI API利用コストの表示
- モダンなUI（Material風・TailwindCSS）

## セットアップ

### 1. 必要な環境変数の設定

プロジェクトルート直下に`env.sample`を参考に`.env.local`ファイルを作成し、以下のようにOpenAI APIキーを記載してください。

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ※ Google翻訳エンジンはAPIキー不要です。

### 2. Docker Composeでの起動

```bash
docker compose up --build
```

- `.env.local`の内容はDockerコンテナにも自動で反映されます。

### 3. ローカル開発サーバーでの起動

```bash
npm install
npm run dev
```

### 4. アプリへのアクセス

[http://localhost:13001](http://localhost:13001)  
（Dockerの場合。ローカル開発は[http://localhost:3000](http://localhost:3000)）

---

## 使い方

1. **音声ファイル**または**テキストファイル**をアップロード
2. 「文字起こし&翻訳実行」ボタンをクリック
3. タイトル下のラジオボタンで翻訳エンジン（OpenAI/Google）を選択可能
4. 音声再生に合わせて、英語・日本語テキストが同期ハイライト表示されます
5. 結果をTSV形式でダウンロード・再アップロード可能

---

## 翻訳エンジンについて

- **OpenAI**: 高精度・有料（APIキー必須、コスト表示あり）
- **Google翻訳**: 高速・無料（APIキー不要、非公式API利用）

---

## 注意事項

- `.env.local`には機密情報（APIキー等）を記載するため、**必ず.gitignoreに追加**してください。
- Google翻訳は非公式APIを利用しているため、商用利用や大量リクエストにはご注意ください。

---
