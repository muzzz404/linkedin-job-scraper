const puppeteer = require('puppeteer');
const path = require('path');

const NAME = "Salma Hossam";
const EMAIL = "your@email.com";
const PHONE = "0501234567"; // optional
const CV_PATH = path.resolve('./CV.pdf'); // place the CV in root of repo

const jobLinks = [
  "https://companyname.workable.com/jobs/123456", // replace with real links
  "https://boards.greenhouse.io/companyname/jobs/987654"
];

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  for (const url of jobLinks) {
    try {
      console.log("🌐 Visiting:", url);
      await page.goto(url, { waitUntil: "networkidle2" });

      // 🎯 Try Greenhouse form
      if (url.includes("greenhouse")) {
        await page.type('input[name="first_name"]', NAME.split(" ")[0]);
        await page.type('input[name="last_name"]', NAME.split(" ")[1]);
        await page.type('input[name="email"]', EMAIL);
        if (PHONE) await page.type('input[name="phone"]', PHONE);
        const fileInput = await page.$('input[type="file"]');
        await fileInput.uploadFile(CV_PATH);
        await page.click('input[type="submit"]');
        console.log("✅ Applied on Greenhouse:", url);
        continue;
      }

      // 🎯 Try Workable form
      if (url.includes("workable")) {
        await page.type('input[name="name"]', NAME);
        await page.type('input[name="email"]', EMAIL);
        const fileInput = await page.$('input[type="file"]');
        await fileInput.uploadFile(CV_PATH);
        await page.click('button[type="submit"]');
        console.log("✅ Applied on Workable:", url);
        continue;
      }

      console.log("❌ Form not supported yet for:", url);
    } catch (err) {
      console.log("⚠️ Error applying to:", url, err.message);
    }
  }

  await browser.close();
})();
