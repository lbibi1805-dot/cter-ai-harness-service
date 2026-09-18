// @ts-check
// ESLint boundary enforcement for the module architecture in
// PLAN_MODULE_ARCHITECTURE.md (mục 5 — Dependency & Import Rule).
//
// This is added in Phase 0 as CI gate infrastructure; the `modules/`,
// `application/`, `presentation/`, `core/`, `shared/` directories are
// populated incrementally across Phase 1-3. Until a zone exists on disk,
// its rule is inert (no files match the pattern), so this config is safe
// to land before the tree is fully migrated.
const tseslint = require('typescript-eslint');
const importPlugin = require('eslint-plugin-import');

const restrictedPaths = [
  // core/* must stay pure: no config, no modules, no application layer.
  {
    target: './src/core/**/*',
    from: ['./src/config/**/*', './src/modules/**/*', './src/application/**/*'],
    message: 'core/* must be pure (no config/modules/application imports) — see PLAN_MODULE_ARCHITECTURE.md mục 5.',
  },
  // application/* is a use-case layer: never import presentation.
  {
    target: './src/application/**/*',
    from: ['./src/presentation/**/*'],
    message: 'application/* must not depend on presentation/* (inverted dependency) — mục 5.',
  },
  // modules/canvas must not depend on modules/ai.
  {
    target: './src/modules/canvas/**/*',
    from: ['./src/modules/ai/**/*'],
    message: 'modules/canvas must not import modules/ai — mục 5.',
  },
  // modules/rag must not depend on modules/canvas.
  {
    target: './src/modules/rag/**/*',
    from: ['./src/modules/canvas/**/*'],
    message: 'modules/rag must not import modules/canvas — mục 5.',
  },
  // Cross-module imports may only reach a module's public surface
  // (index.ts / dto.ts / ports.ts), never its internal files — mục 3.1.
  {
    target: [
      './src/application/**/*',
      './src/presentation/**/*',
      './src/modules/!(canvas|ai|files|conversations|rag|vault|extractor|render)/**/*',
    ],
    from: ['./src/modules/*/!(index|dto|ports).ts'],
    message: 'Only import a module\'s index.ts/dto.ts/ports.ts from outside that module — mục 3.1.',
  },
];

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'data/**', 'test-artifacts/**', 'documents-vault/**'],
  },
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    plugins: { import: importPlugin },
    languageOptions: {
      parserOptions: {
        project: false,
      },
    },
    rules: {
      'import/no-restricted-paths': ['error', { zones: restrictedPaths }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
