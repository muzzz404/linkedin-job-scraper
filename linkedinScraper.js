const puppeteer = require("puppeteer");
const axios = require("axios");

const WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK;
const SEARCH_URL = `https://www.linkedin.com/jobs/search/?keywords=guest%20relations&location=United%20Arab%20Emirates&f_TPR=r86400`;

const keywordList = ["guest relations", "guest service", "concierge", "hospitality", "front desk"];
const locationList = [
  "uae", "united arab emirates", "dubai", "abu dhabi", "sharjah", 
  "ajman", "fujairah", "ras al khaimah", "umm al quwain"
];

const jobFilter = (title, location) => {
  const matchKeyword = keywordList.some(keyword =>
    title.toLowerCase().includes(keyword)
  );

  const matchLocation = locationList.some(loc =>
    location.toLowerCase().includes(loc)
  );

  return matchKeyword && matchLocation;
};

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(SEARCH_URL, { waitUntil: "networkidle2" });

  const jobCards = await page.$$('.base-card');

  // 🔁 Get existing job links from Google Sheet (to prevent duplicates)
  const existingLinks = new Set();
  try {
    const readRes = await axios.get(WEBHOOK_URL.replace('/exec', '/exec?mode=read'));
    if (Array.isArray(readRes.data)) {
      readRes.data.forEach(row => existingLinks.add(row.link));
    }
  } catch (err) {
    console.error("⚠️ Couldn't fetch existing jobs:", err.message);
  }

  for (let card of jobCards) {
    try {
      const title = await card.$eval('.base-search-card__title', el => el.innerText.trim());
      const company = await card.$eval('.base-search-card__subtitle', el => el.innerText.trim());
      const location = await card.$eval('.job-search-card__location', el => el.innerText.trim());
      const link = await card.$eval('a.base-card__full-link', el => el.href);

      // Skip if it's a duplicate
      if (existingLinks.has(link)) {
        console.log("⚠️ Skipping duplicate:", title);
        continue;
      }

      if (!jobFilter(title, location)) {
        console.log("❌ Skipping - doesn't match filters:", title);
        continue;
      }

      // Open job link to extract email
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
      console.error("❌ Error processing job:", err.message);
    }
  }

  await browser.close();
})();
