/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const Module = require("node:module");
const ts = require("typescript");
const webpackBundle = require("next/dist/compiled/webpack/webpack");
webpackBundle.init();

module.exports = async function buildConsentPreview() {
  const root = path.resolve(__dirname, "../..");
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "clinical-consent-preview-"));
  const loader = path.join(outputDir, "tsx-loader.cjs");
  await fs.writeFile(loader, `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText; };`);
  const stub = path.join(root, "tests/fixtures/consent-preview-actions.ts");
  await new Promise((resolve, reject) => webpackBundle.webpack({
    mode: "development", devtool: false, target: "web", context: root,
    entry: path.join(root, "tests/fixtures/consent-dialog-preview.tsx"),
    output: { path: outputDir, filename: "preview.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/features/consultations/booking/actions$": stub,
      "@/features/identity-verification/BookingIdentityVerification$": stub,
      "@": root
    } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }] }
  }, (error, stats) => {
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
  const tokenFile = path.join(root, "lib/design-system/tokens.ts");
  const tokenModule = new Module(tokenFile, module);
  tokenModule._compile(ts.transpileModule(await fs.readFile(tokenFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, tokenFile);
  const files = ["features/consultations/consent/TelemedicineConsentDialog.tsx", "features/consultations/consent/BookingTelemedicineConsent.tsx", "features/consultations/consent/TelemedicineConsentContent.tsx", "features/consultations/booking/BookingTimeSlotForm.tsx"];
  const css = await require("postcss")([require("tailwindcss")({ content: await Promise.all(files.map(async file => ({ raw: await fs.readFile(path.join(root, file), "utf8"), extension: "tsx" }))), theme: { extend: tokenModule.exports.stitchTailwindTheme } })]).process(await fs.readFile(path.join(root, "app/globals.css"), "utf8"), { from: undefined });
  const result = { javascript: await fs.readFile(path.join(outputDir, "preview.js"), "utf8"), css: css.css };
  if (!path.resolve(outputDir).startsWith(path.join(path.resolve(os.tmpdir()), "clinical-consent-preview-"))) throw new Error("Unexpected preview directory");
  await fs.rm(outputDir, { recursive: true });
  return result;
};
