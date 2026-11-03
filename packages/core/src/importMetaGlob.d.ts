// Vitest runs core's tests through Vite, which replaces `import.meta.glob` with the files it
// matches. Core does not depend on Vite, so this declares only the eager form its tests use.
interface ImportMeta {
  glob<T>(pattern: string, options: { eager: true; import: 'default' }): Record<string, T>;
}
