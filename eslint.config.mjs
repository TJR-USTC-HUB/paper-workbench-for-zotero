// @ts-check Let TS check this config file

import zotero from "@zotero-plugin/eslint-config";

export default zotero({
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        // We disable this rule here because the template
        // contains some unused examples and variables
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
    {
      files: [
        "scripts/dev-browser-paths.mjs",
        "scripts/inspect-deepseek-dom.mjs",
        "scripts/live-test-deepseek-agent.mjs",
      ],
      languageOptions: {
        globals: {
          Buffer: "readonly",
          URL: "readonly",
          clearTimeout: "readonly",
          fetch: "readonly",
          process: "readonly",
          setTimeout: "readonly",
        },
      },
    },
  ],
});
