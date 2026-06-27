import React from "react";
import ReactMarkdown, { type Components, type UrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

export type AppChangelogMarkdownProps = {
  content: string;
};

const changelogMarkdownComponents: Components = {
  a: ({ node: _node, href, children, ...rest }) => {
    const safeHref = typeof href === "string" ? toAllowedChangelogHref(href) : null;

    if (!safeHref) {
      return React.createElement("span", { className: "app-changelog-unsafe-link" }, children);
    }

    return React.createElement(
      "a",
      {
        ...rest,
        href: safeHref,
        ...(isExternalChangelogHref(safeHref) ? { target: "_blank", rel: "noreferrer" } : {})
      },
      children
    );
  },
  img: ({ node: _node, alt }) =>
    React.createElement(
      "span",
      { className: "app-changelog-image-fallback" },
      alt ? `Bild entfernt: ${alt}` : "Bild entfernt"
    )
};

const transformChangelogUrl: UrlTransform = (url) => toAllowedChangelogHref(url);

export function AppChangelogMarkdown(props: AppChangelogMarkdownProps): React.ReactElement {
  return React.createElement(
    "div",
    { className: "app-changelog-markdown" },
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        skipHtml: true,
        urlTransform: transformChangelogUrl,
        components: changelogMarkdownComponents
      },
      props.content
    )
  );
}

function toAllowedChangelogHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("#")) {
    return trimmed;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  if (!/^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

function isExternalChangelogHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}
