import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "a",
  "span",
  "div"
];

const ALLOWED_ATTR = ["href", "title"];
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):|\/|#)/i;

export function sanitizeHtmlFragment(value: string): string {
  if (value.length === 0) {
    return "";
  }

  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP
  });
}
