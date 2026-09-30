"""Injects PWA / iOS home-screen meta tags into Expo's generated dist/index.html.

Run this after `npx expo export -p web` and before deploying — expo's export
doesn't add these on its own (newer Metro-based web export dropped the old
webpack-based PWA auto-injection), so this patches them in as a repeatable
post-export step.
"""
import re

PATH = "dist/index.html"

TAGS = """
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#5AAD7A" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="NutriLens" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }
  </script>
"""

with open(PATH, "r", encoding="utf-8") as f:
    html = f.read()

if 'rel="manifest"' in html:
    print("PWA tags already present, skipping")
else:
    html = html.replace("</head>", TAGS + "</head>")
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print("Injected PWA tags into", PATH)
