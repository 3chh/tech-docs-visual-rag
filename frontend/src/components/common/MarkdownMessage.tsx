import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

/**
 * Tiền xử lý văn bản Markdown / LaTeX để KaTeX và remark-math biên dịch hoàn hảo.
 * Tự động sửa các lỗi phổ biến từ mô hình ngôn ngữ hoặc dữ liệu:
 * - Ký hiệu \( ... \) và \[ ... \]
 * - Dấu $ bị thiếu đóng ở cuối câu/dòng
 * - Khối phương trình $$...$$ cần dòng trống bao quanh
 */
export function preprocessMarkdown(text: string): string {
  if (!text) return "";

  // 1. Chuyển đổi ký hiệu LaTeX \( ... \) sang $ ... $
  let processed = text.replace(/\\\(([\s\S]*?)\\\)/g, "$$1$");

  // 2. Chuyển đổi khối LaTeX \[ ... \] sang $$ ... $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, "\n\n$$$$1$$\n\n");

  // 3. Tự động đóng dấu $ mở bị thiếu đóng (ví dụ: $\lambda = l_e / r. -> $\lambda = l_e / r$.)
  const lines = processed.split("\n");
  const fixedLines = lines.map((line) => {
    const dollarMatches = line.match(/(?<!\\)\$/g);
    if (dollarMatches && dollarMatches.length % 2 !== 0) {
      const lastDollarIdx = line.lastIndexOf("$");
      const afterLastDollar = line.slice(lastDollarIdx + 1);
      if (
        afterLastDollar.includes("\\") ||
        afterLastDollar.includes("=") ||
        afterLastDollar.includes("/") ||
        afterLastDollar.includes("_")
      ) {
        const punctMatch = afterLastDollar.match(/([.,;:!?])\s*$/);
        if (punctMatch && punctMatch.index !== undefined) {
          const mathBody = afterLastDollar.slice(0, punctMatch.index);
          const punct = afterLastDollar.slice(punctMatch.index);
          return line.slice(0, lastDollarIdx) + `$${mathBody}$` + punct;
        } else {
          return line + "$";
        }
      }
    }
    return line;
  });

  processed = fixedLines.join("\n");

  // 4. Đảm bảo khối $$...$$ có dòng trống bao quanh để remark-math parse chính xác
  processed = processed.replace(/([^\n])\s*\$\$([\s\S]*?)\$\$\s*([^\n])/g, "$1\n\n$$$2$$\n\n$3");

  return processed;
}

export function MarkdownMessage({
  content,
  className,
}: MarkdownMessageProps) {
  const processedContent = React.useMemo(() => {
    return preprocessMarkdown(content);
  }, [content]);

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-[15px] leading-relaxed",
        "prose-p:my-2 prose-p:leading-relaxed",
        "prose-headings:font-semibold prose-headings:my-2.5",
        "prose-ul:my-2 prose-ul:pl-5 prose-ol:my-2 prose-ol:pl-5",
        "prose-li:my-1",
        "prose-code:font-mono prose-code:text-xs prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 leading-relaxed text-foreground">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          ul: ({ children }) => <ul className="list-disc my-2 pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => (
            <ol className="list-decimal my-2 pl-5 space-y-1.5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed text-foreground/90">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs font-mono border">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-foreground/90 font-medium">
                {children}
              </code>
            );
          },
          // Tinh chỉnh hiển thị block math equation
          div: ({ node, className, children, ...props }) => {
            if (className?.includes("math-display")) {
              return (
                <div
                  className="my-3 overflow-x-auto rounded-md bg-muted/20 py-2.5 px-4 text-center border border-border/40 shadow-2xs"
                  {...props}
                >
                  {children}
                </div>
              );
            }
            return <div className={className} {...props}>{children}</div>;
          },
          span: ({ node, className, children, ...props }) => {
            if (className?.includes("math-inline")) {
              return (
                <span className="font-serif px-0.5 font-medium" {...props}>
                  {children}
                </span>
              );
            }
            return <span className={className} {...props}>{children}</span>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
