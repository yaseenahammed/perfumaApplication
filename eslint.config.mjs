import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    files: ["**/*.js"], // ✅ Lint all JS files in project
    ignores: ["node_modules/**", "dist/**", "build/**"], // ✅ Ignore common dirs
    languageOptions: {
      globals: globals.node, // ✅ Allow Node.js globals (require, __dirname, etc.)
    },
    rules: {
      ...pluginJs.configs.recommended.rules, // ✅ Start with recommended rules
      "no-unused-vars": "off", // Example custom rule
      "no-console": "off", // Allow console logs if you want
    },
  },
];
