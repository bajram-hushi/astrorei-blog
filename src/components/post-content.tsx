import sanitizeHtml from "sanitize-html";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type PostContentProps = {
  content: string;
  format: "markdown" | "richtext";
};

export function PostContent({ content, format }: PostContentProps) {
  if (format === "richtext") {
    const safeHtml = sanitizeHtml(content, {
      allowedTags: [
        ...sanitizeHtml.defaults.allowedTags,
        "img",
        "h1",
        "h2",
        "h3",
        "u",
        "input",
        "label",
        "span",
        "div",
      ],
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ["src", "alt", "title"],
        a: ["href", "name", "target", "rel"],
        ul: ["data-type"],
        li: ["data-type", "data-checked"],
        label: ["contenteditable"],
        input: ["type", "checked", "disabled"],
        span: ["class"],
        code: ["class"],
        pre: ["class"],
        div: ["data-type"],
      },
      allowedSchemes: ["http", "https", "mailto", "data"],
    });

    return (
      <article
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <article className="prose max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
