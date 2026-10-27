import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: ".output",
  manifest: ({ browser, manifestVersion }) => ({
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "fr",
    permissions: ["storage", "alarms"],
    host_permissions: ["https://x.com/*"],
    // Feed hosts are granted one by one when the user subscribes (see options page).
    // MV2 (Firefox) has no optional_host_permissions key; origins go in optional_permissions.
    ...(manifestVersion === 2 ? { optional_permissions: ["https://*/*"] } : { optional_host_permissions: ["https://*/*"] }),
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: { id: "pare-facho@lnilluv.github.io", strict_min_version: "128.0" },
          },
        }
      : {}),
  }),
});
