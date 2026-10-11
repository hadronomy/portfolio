declare module '*?inline' {
  const value: string;
  export default value;
}

interface ImportMeta {
  /** Vite's build-time file import, here for migration SQL as text. */
  glob(
    pattern: string,
    options: { query: '?raw'; import: 'default'; eager: true },
  ): Record<string, string>;
}
