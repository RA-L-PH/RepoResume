const puppeteer = require('puppeteer');

async function scrapePage(url) {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract main content using basic readability-like approach
    const content = await page.evaluate(() => {
        // Remove script, style, nav, footer, etc.
        const toRemove = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe'];
        toRemove.forEach(tag => {
            const elements = document.getElementsByTagName(tag);
            while (elements.length > 0) elements[0].parentNode.removeChild(elements[0]);
        });

        // Get text from body
        return document.body.innerText;
    });

    return content.replace(/\s+/g, ' ').trim().substring(0, 15000); // Limit to ~15k chars for LLM safety
  } catch (error) {
    console.error(`[SCRAPER ERROR] ${url}:`, error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapePage };
