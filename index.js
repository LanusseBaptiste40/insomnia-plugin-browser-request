const puppeteer = require('puppeteer');

module.exports.templateTags = [
  {
    name: "browserRequest",
    displayName: "Browser Request",
    description: "Run a request in the browser and return when target URL is reached",
    args: [
      {
        displayName: "Redirect URL",
        type: "string",
        help: "Specify the URL to wait for (e.g., http://localhost:8000/callback)",
      },
    ],
    async run(context, redirectUrl) {
      if (!redirectUrl) {
        throw new Error("Redirect URL must be specified");
      }

      const requestUrl = context.request.getUrl();

      console.log(`Opening browser to: ${requestUrl}`);
      console.log(`Waiting for redirect to: ${redirectUrl}`);

      // Launch Puppeteer
      const browser = await puppeteer.launch({ headless: false });
      const page = await browser.newPage();

      try {
        // Navigate to the initial URL
        await page.goto(requestUrl);

        // Wait for the target URL to be reached
        await page.waitForFunction(
          (url) => window.location.href.includes(url),
          {},
          redirectUrl
        );

        console.log("Redirect detected!");

        // Capture the final URL or data
        const finalUrl = await page.url();
        await browser.close();

        return `Redirect to ${finalUrl} detected!`;
      } catch (error) {
        await browser.close();
        throw new Error(`Error during browser operation: ${error.message}`);
      }
    },
  },
];