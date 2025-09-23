/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer.
  cacheDirectory: __dirname + '/.cache/puppeteer',
  // Specifies the browser to use.
  browser: 'chrome-for-testing',
  // Skip downloading the default browser.
  skipDownload: true,
};
