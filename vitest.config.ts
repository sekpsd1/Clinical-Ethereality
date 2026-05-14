import path from "node:path";
import ts from "typescript";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "vitest-tsx-transform",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith(".tsx")) {
          return null;
        }

        const result = ts.transpileModule(code, {
          fileName: id,
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2020,
            sourceMap: true
          }
        });

        return {
          code: result.outputText,
          map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null
        };
      }
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.{ts,tsx}"]
  }
});
