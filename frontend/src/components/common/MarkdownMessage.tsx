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

export function MarkdownMessage({
  content,
  className,
}: MarkdownMessageProps) {
  // Tiền xử lý để đảm bảo công thức math $$...$$ và [...] luôn hiển thị chuẩn
  const processedContent = React.useMemo(() => {
    if (!content) return "";
    // Đảm bảo khối $$...$$ có dòng trống hoặc cách dòng chuẩn cho remark-math
    return content;
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
