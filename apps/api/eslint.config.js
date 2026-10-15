import base from '@ashian/config/eslint/base';

export default [
  ...base,
  {
    rules: {
      // Nest برای DI به import واقعی کلاس‌ها (نه type-only) نیاز دارد
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // اسکریپت‌های CLI (مثل smoke) خروجی کنسول دارند
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
];
