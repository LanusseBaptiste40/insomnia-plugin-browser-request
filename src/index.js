// const React = require("react");
const puppeteer = require("puppeteer");

const logPlugin = "[browser-request]";

// Key to store plugin settings
const PLUGIN_SETTINGS_KEY = "browserRequestSettings";

module.exports.requestHooks = [
  async (context) => {
    const { request } = context;

    const requestId = request.getId();

    console.log(
      logPlugin,
      `Searching config for key: ${PLUGIN_SETTINGS_KEY}-${requestId}`
    );

    const settingsValue = await context.store.getItem(
      `${PLUGIN_SETTINGS_KEY}-${requestId}`
    );

    console.log(logPlugin, `Config found for plugin : ${settingsValue}`);

    if (!settingsValue) {
      console.log(
        logPlugin,
        "Plugin has not been configured for this request, skipping."
      );
      return;
    }

    const settings = JSON.parse(settingsValue);
    if (!settings || !settings.enabled) {
      console.log(
        logPlugin,
        "Plugin is not enabled for this request, skipping."
      );
      return;
    }

    const redirectUrl = settings.redirectUrl;
    if (!redirectUrl) {
      console.log(logPlugin, "Redirect URL not set, skipping.");
      return;
    }

    console.log(
      logPlugin,
      `Plugin is enabled, redirect URL set to: ${redirectUrl}`
    );

    const requestUrl = request.getUrl();

    console.log(
      logPlugin,
      `Launching Puppeteer browser to url: "${requestUrl}"...`
    );

    // Use Puppeteer to handle the browser request
    const browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(requestUrl);
    const finalResponse = await page.waitForRequest((request) => {
      return request.url().includes(redirectUrl);
    });
    await browser.close();

    console.log(logPlugin, `Redirect URL reached: ${finalResponse.url()}`);
    await context.store.setItem(
      "browser-plugin-response",
      JSON.stringify({
        finalUrl: finalResponse.url(),
      })
    );
  },
];

const jsonObjToBuffer = (obj) => Buffer.from(JSON.stringify(obj), "utf-8");

module.exports.responseHooks = [
  async (context) => {
    const { request } = context;

    const requestId = request.getId();

    console.log(
      logPlugin,
      `Searching config for key: ${PLUGIN_SETTINGS_KEY}-${requestId}`
    );

    const settingsValue = await context.store.getItem(
      `${PLUGIN_SETTINGS_KEY}-${requestId}`
    );

    console.log(logPlugin, `Config found for plugin : ${settingsValue}`);

    if (!settingsValue) {
      console.log(
        logPlugin,
        "Plugin has not been configured for this request, skipping."
      );
      return;
    }

    const settings = JSON.parse(settingsValue);
    if (!settings || !settings.enabled) {
      console.log(
        logPlugin,
        "Plugin is not enabled for this request, skipping."
      );
      return;
    }

    try {
      console.log(logPlugin, "Response Hook fired, updating response");

      const originalStatus = context.response.getStatusCode();
      const originalHeaders = context.response.getHeaders();
      const originalBody = await context.response.getBody();

      console.log(logPlugin, "Original Response:", {
        status: originalStatus,
        headers: originalHeaders,
        body: originalBody,
      });

      const responseValue = await context.store.getItem(
        "browser-plugin-response"
      );

      console.log(logPlugin, `Final value found : "${responseValue}", building response...`);

      const params = {};

      const queryString = JSON.parse(responseValue).finalUrl.split('?')[1];
      if (queryString) {
        const pairs = queryString.split('&');

        pairs.forEach(pair => {
          const [key, value] = pair.split('=');
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        });
      }

      context.response.setBody(jsonObjToBuffer(params));
    } catch (error) {
      console.error(
        logPlugin,
        `Something went wrong with response hook : ${error.message}`
      );
    }
  },
];

module.exports.requestGroupActions = [
  {
    label: "Set Browser Request Plugin Settings for Group",
    action: async (context, data) => {
      const { requests, requestGroup } = data;

      const groupId = requestGroup._id;

      const lastSettingsValue = await context.store.getItem(
        `${PLUGIN_SETTINGS_KEY}-${groupId}`
      );

      let lastSettings = {
        enabled: "false",
        redirectUrl: "",
      };

      if (lastSettingsValue) {
        console.log(logPlugin, `last settings found : ${lastSettingsValue}`);
        try {
          let parsedLastSettings = JSON.parse(lastSettingsValue);
          if (parsedLastSettings) {
            lastSettings = parsedLastSettings;
          }
        } catch (error) {
          console.log(
            logPlugin,
            `Could not parse content of last settings: ${error.message}`
          );
        }
      }

      const redirectUrl = await context.app.prompt(
        "Enter Redirect URL for this group (empty to disable plugin).",
        {
          label: "Redirect URL",
          submitName: "Save",
          placeholder: "http://localhost:8000/callback",
          defaultValue: lastSettings.redirectUrl,
        }
      );

      let newSettings = {
        enabled: "true",
        redirectUrl: redirectUrl,
      };

      if (!redirectUrl) {
        console.log(
          logPlugin,
          "Redirect URL not provided, disabling Browser Request Plugin for the group."
        );
        newSettings = {
          enabled: "false",
          redirectUrl: "",
        };

        for (const request of requests) {
          await context.store.removeItem(
            `${PLUGIN_SETTINGS_KEY}-${request._id}`
          );
        }
        await context.store.removeItem(`${PLUGIN_SETTINGS_KEY}-${groupId}`);
        return;
      }

      console.log(logPlugin, `New settings : ${JSON.stringify(newSettings)}`);

      for (const request of requests) {
        console.log(
          logPlugin,
          `Applying config for key: ${PLUGIN_SETTINGS_KEY}-${request._id}`
        );
        await context.store.setItem(
          `${PLUGIN_SETTINGS_KEY}-${request._id}`,
          JSON.stringify(newSettings)
        );
      }
      console.log(
        logPlugin,
        `Applying config for key: ${PLUGIN_SETTINGS_KEY}-${groupId}`
      );
      await context.store.setItem(
        `${PLUGIN_SETTINGS_KEY}-${groupId}`,
        JSON.stringify(newSettings)
      );

      console.log(logPlugin, `Browser Request Plugin enabled for the group.`);
    },
  },
];

// module.exports.requestTabs = [
//   {
//     name: "Browser Request",
//     render: (context, request) => {
//       const [settings, setSettings] = React.useState(null);

//       React.useEffect(() => {
//         async function loadSettings() {
//           const storedSettings = await context.store.getItem(
//             `${PLUGIN_SETTINGS_KEY}-${request._id}`
//           );
//           setSettings(storedSettings || { enabled: false, redirectUrl: "" });
//         }
//         loadSettings();
//       }, [request._id]);

//       const handleToggle = async () => {
//         const newSettings = { ...settings, enabled: !settings.enabled };
//         setSettings(newSettings);
//         await context.store.setItem(
//           `${PLUGIN_SETTINGS_KEY}-${request._id}`,
//           newSettings
//         );
//       };

//       const handleUrlChange = async (e) => {
//         const newSettings = { ...settings, redirectUrl: e.target.value };
//         setSettings(newSettings);
//         await context.store.setItem(
//           `${PLUGIN_SETTINGS_KEY}-${request._id}`,
//           newSettings
//         );
//       };

//       if (!settings) return <div>Loading...</div>;

//       return (
//         <div>
//           <label>
//             <input
//               type="checkbox"
//               checked={settings.enabled}
//               onChange={handleToggle}
//             />
//             Enable Browser Request
//           </label>
//           <br />
//           <label>
//             Redirect URL:
//             <input
//               type="text"
//               value={settings.redirectUrl}
//               onChange={handleUrlChange}
//               disabled={!settings.enabled}
//               placeholder="http://localhost:8000/callback"
//             />
//           </label>
//         </div>
//       );
//     },
//   },
// ];
