const puppeteer = require('puppeteer');
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

async function generatePDFFromMarkdown(markdown) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color: #1a202c;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #1a365d; border-bottom: 2px solid #2b6cb0; padding-bottom: 10px; }
        h2 { font-size: 20px; font-weight: 600; margin-top: 24px; margin-bottom: 12px; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
        h3 { font-size: 16px; font-weight: 600; margin-top: 16px; margin-bottom: 8px; color: #3182ce; }
        h4 { font-size: 14px; font-weight: 600; margin-top: 12px; margin-bottom: 4px; color: #4a5568; }
        p { margin-bottom: 12px; font-size: 14px; }
        ul { margin-bottom: 12px; padding-left: 20px; }
        li { margin-bottom: 4px; font-size: 14px; }
        strong { font-weight: 600; color: #2d3748; }
        hr { border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0; }
        .contact-info { font-size: 12px; color: #718096; margin-bottom: 20px; text-align: center; }
        @media print {
          body { padding: 0; }
          a { text-decoration: none; color: #1a202c; }
        }
      </style>
    </head>
    <body>
      ${md.render(markdown)}
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'Letter',
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    printBackground: true
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = { generatePDFFromMarkdown };
