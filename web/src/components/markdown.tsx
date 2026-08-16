import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Listing copy is stored as markdown all the way through the pipeline — never
 * HTML — so it can be rendered here without ever concatenating scraped text
 * into the page as markup. Links open in a new tab and carry rel="noreferrer",
 * because every one of them points at a third-party site we do not control.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-listing text-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
