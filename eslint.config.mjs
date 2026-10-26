import js from '@eslint/js';
import globals from 'globals';

// Pliki gry to zwykłe skrypty (bez modułów) ładowane po kolei w index.html / tv.html –
// współdzielą zmienne globalne, dlatego no-undef jest wyłączone, a no-unused-vars pilnuje tylko zmiennych lokalnych.
export default [
  { ignores: ['node_modules/', '**/.wrangler/', 'playwright-report/', 'test-results/', 'songs.js', 'songs-sp.js', 'facts.js', 'flags/'] },
  js.configs.recommended,
  {
    files: ['*.js', 'js/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser } },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ['tests/**/*.mjs', 'tools/**/*.mjs', '*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    // serwer pośredniczący (Cloudflare Workers) – moduł z interfejsami środowiska Workers
    files: ['server/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.serviceworker, WebSocketPair: 'readonly', WebSocketRequestResponsePair: 'readonly' } },
    rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
  {
    files: ['tests/mock.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    // kod wykonywany w przeglądarce przez page.evaluate – odwołuje się do zmiennych gry
    files: ['tests/**/*.spec.mjs', 'tests/fixtures.mjs', 'tools/screens*.mjs'],
    rules: { 'no-undef': 'off' },
  },
];
