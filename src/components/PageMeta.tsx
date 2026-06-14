import { useEffect } from "react";
import { useLocation } from "react-router";
import { useTheme } from "../lib/useTheme";

const siteOrigin = "https://thia.lol";
const siteName = "thia.lol";

type PageMetaProps = {
  title: string;
  description: string;
  path?: string;
};

const themeColors = {
  sunveil: "#f8e8a9",
  frostveil: "#223454",
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
    setMeta("name", "theme-color", themeColors[theme]);
    setMeta("property", "og:site_name", siteName);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    removeMeta("property", "og:image");
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    removeMeta("name", "twitter:image");
    setCanonical(canonicalUrl);
  }, [description, location.pathname, path, theme, title]);

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

function removeMeta(attribute: "name" | "property", key: string) {
  document.head
    .querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
    .forEach((element) => element.remove());
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
