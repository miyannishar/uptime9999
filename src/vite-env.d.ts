/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_LOG_LEVEL?: 'INFO' | 'DEBUG';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

