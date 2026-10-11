const { chromium } = require("playwright-core");
const os = require("os");
const path = require("path");

// Find a Chrome/Chromium binary on this machine
function findChrome() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
  ];
  for (const c of candidates) {
    if (require("fs").existsSync(c)) return c;
  }
  return null;
}

(async () => {
  const exe = findChrome();
  if (!exe) {
    console.log("NO_CHROME");
    process.exit(0);
  }
  // Fresh user-data-dir => no extensions, no localStorage, no cache
  const tmp = path.join(os.tmpdir(), "hs-headless-" + Date.now());
  const context = await chromium.launchPersistentContext(tmp, {
    executablePath: exe,
    args: ["--no-sandbox"],
  });
  const page = await context.newPage();
  await page.goto("https://hs.sclink.dev/ui/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const root = document.getElementById("root");
    const txt = (root ? root.innerText : document.body.innerText) || "";
    return {
      htmlLang: document.documentElement.lang,
      storedLang: localStorage.getItem("hs_lang"),
      text: txt.slice(0, 600),
    };
  });

  // Count traditional-only glyphs in the rendered text
  const trad = "國機個們線關點帳體覽錄網這來頭時狀開設連確選頁語簡帶實為從兩與無處動裝置複製載入登入使用者帳號密碼權金鑰區規則驗證儲存顯示電子郵件資訊歷記錄";
  let tradCount = 0;
  const found = new Set();
  for (const ch of info.text) {
    if (trad.includes(ch)) { tradCount++; found.add(ch); }
  }

  console.log("HTML lang        :", info.htmlLang);
  console.log("localStorage hs_lang:", info.storedLang);
  console.log("繁体专属字出现次数 :", tradCount, found.size ? "字符:" + [...found].join("") : "");
  console.log("--- 页面渲染出来的前 600 字（真实 DOM 文字）---");
  console.log(info.text);

  await context.close();
})().catch((e) => { console.log("ERR", e.message); process.exit(1); });
