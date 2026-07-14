import { useEffect } from "react";
import { useLocation } from "react-router";
import { useTheme } from "../lib/useTheme";

const siteOrigin = "https://thia.lol";
const siteName = "thia.lol";
const defaultImagePath = "/brand/thia-og.png";
const defaultImageAlt = "thia.lol pink bunny mark.";

type PageMetaProps = {
  title: string;
  description: string;
  path?: string;
};

const themeColors = {
  light: "#fff6fb",
  dark: "#092119",
};

export function PageMeta({ title, description, path }: PageMetaProps) {
  const location = useLocation();
  const { theme } = useTheme();

  useEffect(() => {
    const routePath = path ?? location.pathname;
    const canonicalUrl = new URL(routePath, siteOrigin).toString();
    const fullTitle = title === siteName ? siteName : `${title} | ${siteName}`;

    document.title = fullTitle;
    setMeta("name", "description", description);
    setMeta("property", "og:site_name", siteName);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", new URL(defaultImagePath, siteOrigin).toString());
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:image:alt", defaultImageAlt);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", new URL(defaultImagePath, siteOrigin).toString());
    setMeta("name", "twitter:image:alt", defaultImageAlt);
    setCanonical(canonicalUrl);
  }, [description, location.pathname, path, title]);

  useEffect(() => {
    const root = document.documentElement;
    const syncThemeColor = () => {
      const profileCanvas = root.dataset.profileTheme
        ? root.style.getPropertyValue("--app-canvas").trim()
        : "";

      setMeta("name", "theme-color", profileCanvas || themeColors[theme]);
    };

    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-profile-theme", "style"],
    });

    return () => observer.disconnect();
  }, [theme]);

  return null;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }

  element.content = content;
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.append(element);
  }

  element.href = url;
}
