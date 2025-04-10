const puppeteer = require("puppeteer");
const axios = require("axios");

const WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK;

const SEARCH_URL = `https://www.linkedin.com/jobs/search/?keywords=real%20estate%20marketing&location=Dubai&f_TPR=r86400`; // last 24 hrs

async function scrapeJobs() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(SEARCH_URL, { waitUntil: "networkidle2" });

  const jobCards = await page.$$('.base-card');

  for (let card of jobCards) {
    try {
      const title = await card.$eval('.base-search-card__title', el => el.innerText.trim());
      const company = await card.$eval('.base-search-card__subtitle', el => el.innerText.trim());
      const location = await card.$eval('.job-search-card__location', el => el.innerText.trim());
      const link = await card.$eval('a.base-card__full-link', el => el.href);

      const jobPage = await browser.newPage();
      await jobPage.goto(link, { waitUntil: "domcontentloaded" });

      const jobText = await jobPage.evaluate(() => document.body.innerText);
      const emailMatch = jobText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
      const email = emailMatch ? emailMatch[0] : "";

      await axios.post(WEBHOOK_URL, {
        title,
        company,
        location,
        link,
        email
      });

      console.log("✅ Sent:", title);
      await jobPage.close();
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  }

  await browser.close();
}

scrapeJobs();
