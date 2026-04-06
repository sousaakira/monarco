export default [
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'out/**',
      'node_modules/**',
      'assets/**',
      '**/*.vue'
    ]
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {}
  }
]
