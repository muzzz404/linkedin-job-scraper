const puppeteer = require("puppeteer");
const axios = require("axios");

const SHEET_READ_URL = process.env.GOOGLE_SHEET_WEBHOOK.replace("/exec", "/exec?mode=readAll");
const SHEET_POST_URL = process.env.GOOGLE_SHEET_WEBHOOK;

const duckSearch = async (companyName) => {
  try {
    const res = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(companyName + ' Dubai official site')}&format=json`);
    const results = res.data?.RelatedTopics || [];
    for (let topic of results) {
      if (topic.FirstURL && topic.FirstURL.includes(".")) {
        return topic.FirstURL;
      }
    }
  } catch (err) {
    console.log("❌ DuckDuckGo failed:", err.message);
  }
  return "";
};

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  const res = await axios.get(SHEET_READ_URL);
  const jobList = res.data;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/;

  for (let job of jobList) {
    if (job.status === "Email Missing") {
      try {
        await page.goto(job.link, { waitUntil: "domcontentloaded" });
        const jobText = await page.evaluate(() => document.body.innerText);
        const jobDescription = jobText.substring(0, 3000); // limit size

        // 1st try: Look for email in job description
        const match = jobText.match(emailRegex);
        if (match) {
          await axios.post(SHEET_POST_URL, {
            title: job.title,
            company: job.company,
            location: job.location,
            link: job.link,
            email: match[0]
          });
          console.log("✅ Email found in job:", job.title);
          continue;
        }

        // 2nd try: Search company site via DuckDuckGo
        const companyUrl = await duckSearch(job.company);
        if (companyUrl) {
          await page.goto(companyUrl, { waitUntil: "domcontentloaded" });
          const siteText = await page.evaluate(() => document.body.innerText);
          const siteMatch = siteText.match(emailRegex);
          if (siteMatch) {
            await axios.post(SHEET_POST_URL, {
              title: job.title,
              company: job.company,
              location: job.location,
              link: job.link,
              email: siteMatch[0]
            });
            console.log("✅ Email found on site:", siteMatch[0]);
            continue;
          }
        }

        // Final fallback: post with job description and no email
        await axios.post(SHEET_POST_URL, {
          title: job.title,
          company: job.company,
          location: job.location,
          link: job.link,
          email: "",
          description: jobDescription
        });
        console.log("⚠️ No email found for:", job.title);

      } catch (err) {
        console.log("❌ Error:", job.title, err.message);
      }
    }
  }

  await browser.close();
})();
