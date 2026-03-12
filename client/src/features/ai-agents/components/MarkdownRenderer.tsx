import { memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

// Import highlight.js github-dark theme
import "highlight.js/styles/github-dark.min.css";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-400 hover:text-gray-200 transition-colors"
      title={copied ? "Copied!" : "Copy code"}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractTextFromChildren((children as { props: { children?: React.ReactNode } }).props.children);
  }
  return String(children ?? "");
}

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={{
        // Block code with syntax highlighting + copy button
        pre({ children }) {
          const codeText = extractTextFromChildren(children).replace(/\n$/, "");
          return (
            <div className="relative group my-2 -mx-1">
              <pre className="bg-[#0d1117] text-gray-200 rounded-md p-3 text-[12px] leading-relaxed overflow-x-auto">
                {children}
              </pre>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={codeText} />
              </div>
            </div>
          );
        },
        // Inline code
        code({ className, children, ...props }) {
          // If it has a language class, it's inside a <pre> (block code) — render as-is
          if (className) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
          // Inline code styling
          return (
            <code className="bg-brand-indigo/10 dark:bg-white/10 text-brand-indigo dark:text-indigo-300 px-1.5 py-0.5 rounded text-[12px] font-mono" {...props}>
              {children}
            </code>
          );
        },
        // Headers
        h1({ children }) {
          return <h1 className="text-base font-bold mt-3 mb-1.5">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-[14px] font-bold mt-2.5 mb-1">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-[13px] font-semibold mt-2 mb-1">{children}</h3>;
        },
        h4({ children }) {
          return <h4 className="text-[13px] font-semibold mt-1.5 mb-0.5">{children}</h4>;
        },
        // Paragraphs
        p({ children }) {
          return <p className="mb-1.5 last:mb-0">{children}</p>;
        },
        // Lists
        ul({ children }) {
          return <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        // Links
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-indigo dark:text-indigo-400 underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          );
        },
        // Blockquote
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-brand-indigo/30 pl-3 my-1.5 text-muted-foreground italic">
              {children}
            </blockquote>
          );
        },
        // Tables
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2 -mx-1">
              <table className="min-w-full text-[12px] border-collapse">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-muted/50">{children}</thead>;
        },
        th({ children }) {
          return (
            <th className="border border-border/50 px-2 py-1 text-left font-semibold">{children}</th>
          );
        },
        td({ children }) {
          return <td className="border border-border/50 px-2 py-1">{children}</td>;
        },
        // Horizontal rule
        hr() {
          return <hr className="border-border/30 my-2" />;
        },
        // Strong / emphasis
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic">{children}</em>;
        },
        // Strikethrough (from remark-gfm)
        del({ children }) {
          return <del className="line-through opacity-60">{children}</del>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
