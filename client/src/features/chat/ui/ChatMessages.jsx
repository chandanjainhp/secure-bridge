import { useRef, useEffect, forwardRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/utils/utils';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { TypingIndicator } from './TypingIndicator';
import { Copy, Check, Download, ExternalLink, ShieldCheck } from 'lucide-react';

// Estimate message height for virtualization calculations
const ESTIMATED_MESSAGE_HEIGHT = 80; // pixels
const BUFFER_COUNT = 5; // Number of extra messages to render above/below viewport

// Enhanced CodeBlock component with line numbers, copy button, and better styling
function CodeBlock({ language, children, className }) {
  const [copied, setCopied] = useState(false);
  const codeContent = String(children).replace(/\n$/, '');
  
  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('my-4 border-2 border-primary bg-background rounded', className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b-2 border-primary bg-muted/20 rounded-t">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono font-bold tracking-widest text-primary uppercase">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] font-mono font-bold tracking-widest text-muted-foreground hover:text-primary uppercase transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'COPIED' : 'COPY'}</span>
          </button>
          <button
            onClick={() => {
              const blob = new Blob([codeContent], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `code.${language}`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1 text-[11px] font-mono font-bold tracking-widest text-muted-foreground hover:text-primary uppercase transition-colors"
          >
            <Download size={12} />
            <span>DOWNLOAD</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1.25rem',
            background: 'transparent',
            fontSize: '13.5px',
            borderRadius: 0
          }}
          showLineNumbers
          lineNumberStyle={{
            color: '#6e7681',
            fontSize: '12px',
            minWidth: '40px',
            paddingRight: '1rem'
          }}
          lineProps={{ style: { padding: '0 1rem' } }}
        >
          {codeContent}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function ChatMessages({ messages, isStreaming, streamingContent }) {
  const scrollRef = useRef(null);
  const messagesRef = useRef([]);
  const virtualizedMessagesRef = useRef([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);

  // Scroll handler to update scroll position
  const handleScroll = useCallback((event) => {
    const target = event.target;
    if (target && target.classList && target.classList.contains('radix-scroll-area-viewport')) {
      setScrollPosition(target.scrollTop);
    }
  }, []);

  // Resize handler to update container height
  const handleResize = useCallback(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      setContainerHeight(container.clientHeight);
    }
  }, []);

  // Update scroll position when component mounts or messages change significantly
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // Only auto-scroll to bottom if user is already near bottom
        const scrollBottom = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        const isNearBottom = scrollContainer.scrollTop > scrollBottom - 100;
        
        setContainerHeight(scrollContainer.clientHeight);
        
        if (isNearBottom) {
          scrollContainer.scrollTo({ 
            top: scrollContainer.scrollHeight, 
            behavior: 'smooth' 
          });
        }
      }
    }
  }, [messages.length, isStreaming, streamingContent]);

  // Calculate visible message range based on scroll position
  useEffect(() => {
    if (messages.length === 0) {
      setStartIndex(0);
      setEndIndex(0);
      setTotalHeight(0);
      return;
    }

    // Calculate total height (estimate based on message count)
    const estimatedTotalHeight = messages.length * ESTIMATED_MESSAGE_HEIGHT;
    setTotalHeight(estimatedTotalHeight);

    // Calculate which messages should be visible
    const start = Math.max(0, Math.floor(scrollPosition / ESTIMATED_MESSAGE_HEIGHT) - BUFFER_COUNT);
    const end = Math.min(
      messages.length - 1, 
      Math.ceil((scrollPosition + containerHeight) / ESTIMATED_MESSAGE_HEIGHT) + BUFFER_COUNT
    );

    setStartIndex(start);
    setEndIndex(end);
    
    // Update refs for cleanup
    messagesRef.current = messages;
  }, [scrollPosition, containerHeight, messages.length, BUFFER_COUNT]);

  // Get the visible messages
  const visibleMessages = useMemo(() => {
    if (messages.length === 0) return [];
    return messages.slice(startIndex, endIndex + 1);
  }, [messages, startIndex, endIndex]);

  return (
    <TooltipProvider>
      <ScrollArea 
        ref={scrollRef} 
        onScrollCapture={handleScroll}
        onResize={handleResize}
        className="flex-1 w-full h-full"
      >
        <div className="flex justify-center w-full h-full">
          <div className="flex flex-col w-full max-w-4xl pt-16 pb-32 space-y-8 px-4 sm:px-6 lg:px-8">
            <AnimatePresence mode="popLayout" initial={false}>
              {/* Placeholder for content before visible messages */}
              {startIndex > 0 && (
                <div 
                  style={{ 
                    height: `${startIndex * ESTIMATED_MESSAGE_HEIGHT}px`,
                    width: '100%' 
                  }}
                />
              )}
              
              {/* Visible messages */}
              {visibleMessages.map((message, index) => {
                const actualIndex = startIndex + index;
                return <MessageBubble 
                  key={`${message.id}-${actualIndex}`} 
                  message={message} 
                  index={actualIndex} 
                />;
              })}
              
              {/* Streaming message if applicable */}
              {isStreaming && streamingContent && (
                <div 
                  style={{ 
                    height: `${ESTIMATED_MESSAGE_HEIGHT}px`,
                    width: '100%' 
                  }}
                >
                  <StreamingMessage content={streamingContent} />
                </div>
              )}
              
              {/* Placeholder for content after visible messages */}
              {endIndex < messages.length - 1 && (
                <div 
                  style={{ 
                    height: `${(messages.length - endIndex - 1) * ESTIMATED_MESSAGE_HEIGHT}px`,
                    width: '100%' 
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}

const MessageBubble = forwardRef(({ message, index }, ref) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className={cn('group flex flex-col w-full gap-1', isUser && 'items-end')}
    >
      {/* Role label + FHE badge */}
      <span className={cn(
        'font-mono text-[10px] uppercase tracking-[0.15em] font-bold px-1',
        message.isError ? 'text-destructive' : 'text-muted-foreground'
      )}>
        {message.isError ? 'ERROR' : isUser ? 'YOU' : 'ASSISTANT'}
      </span>
      {message.fhe?.enabled && (
        <span
          className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] font-bold text-primary/80"
          title={message.fhe.decryptError
            ? 'Encrypted at rest (decryption failed)'
            : `Encrypted at rest with ${message.fhe.scheme || 'FHE'}`}
        >
          <ShieldCheck className="h-3 w-3" />
          {message.fhe.decryptError ? 'FHE ?' : 'FHE'}
        </span>
      )}

      {/* Message content */}
      <div className={cn(
        'relative max-w-[85%] px-5 py-4 border-2 text-[15px] leading-relaxed',
        message.isError
          ? 'border-destructive/60 bg-destructive/10 text-foreground'
          : isUser
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-primary bg-background text-foreground'
      )}>
        {message.isLoading ? (
          <TypingIndicator />
        ) : isUser ? (
          <p className="whitespace-pre-wrap font-sans font-medium">{message.content}</p>
        ) : (
          <div className="prose prose-slate max-w-none prose-p:my-0 prose-pre:my-4 prose-code:text-primary dark:prose-invert prose-table:my-4 prose-td:px-3 prose-td:py-2 prose-th:px-3 prose-th:py-2 prose-tr:border-b prose-tr:border-primary/20">
            <ReactMarkdown components={{
              // Code blocks with language
              code({ node, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const inline = !match;
                return !inline && match ? (
                  <CodeBlock
                    language={match[1]}
                    children={children}
                    className="my-4"
                  />
                ) : (
                  <code className="bg-muted/30 px-1.5 py-0.5 font-mono text-[13px] border border-primary/20 rounded" {...props}>
                    {children}
                  </code>
                );
              },
              // Tables
              table({ children }) {
                return (
                  <div className="my-4 overflow-x-auto">
                    <table className="border-2 border-primary text-sm font-mono">{children}</table>
                  </div>
                );
              },
              thead({ children }) {
                return <thead className="bg-muted/20">{children}</thead>;
              },
              th({ children }) {
                return <th className="px-4 py-2 border-b-2 border-primary text-left">{children}</th>;
              },
              td({ children }) {
                return <td className="px-4 py-2 border-b border-primary/20">{children}</td>;
              },
              // Task lists
              input({ type, checked, ...props }) {
                if (type === 'checkbox') {
                  return (
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled
                      className="mr-2 accent-primary"
                      {...props}
                    />
                  );
                }
                return <input {...props} />;
              },
              // Block quotes
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 italic text-muted-foreground">
                    {children}
                  </blockquote>
                );
              },
              // Links
              a({ href, children }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    {children}
                  </a>
                );
              },
              // Images
              img({ src, alt }) {
                return (
                  <div className="my-4 flex justify-center">
                    <img
                      src={src}
                      alt={alt || 'Image'}
                      className="max-w-full h-auto rounded border-2 border-primary"
                    />
                  </div>
                );
              },
              // Headings
              h1({ children }) {
                return <h1 className="text-2xl font-bold my-4">{children}</h1>;
              },
              h2({ children }) {
                return <h2 className="text-xl font-bold my-3">{children}</h2>;
              },
              h3({ children }) {
                return <h3 className="text-lg font-bold my-2">{children}</h3>;
              },
              // Horizontal rule
              hr() {
                return <hr className="my-6 border-primary/30" />;
              },
              // Paragraph
              p({ children }) {
                return <p className="my-3">{children}</p>;
              },
            }}>
            {message.content}
          </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {!message.isLoading && (
        <div className={cn('flex items-center gap-3 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300')}>
          <span className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase">
            {message.createdAt ? format(new Date(message.createdAt), 'h:mm a') : ''}
          </span>
          <div className="h-3 w-[2px] bg-primary/20" />
          
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] font-mono font-bold tracking-widest text-muted-foreground hover:text-primary uppercase transition-colors"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            <span>{copied ? 'COPIED' : 'COPY'}</span>
          </button>
          
          {/* Divider */}
          <div className="h-3 w-[2px] bg-primary/20" />
          
          {/* Regenerate button (only for assistant messages) */}
          {!isUser && (
            <>
              <button
                onClick={() => {
                  // Resend the last user message to regenerate
                  if (window?.parent?.handleRegenerate) {
                    window.parent.handleRegenerate();
                  }
                }}
                className="flex items-center gap-1 text-[10px] font-mono font-bold tracking-widest text-muted-foreground hover:text-primary uppercase transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m15.356 2l-1.723 1.723a2.998 2.998 0 01-4.177 0L12 10.414l-1.723 1.723a2.998 2.998 0 01-4.177 0L4.582 11H4a8 8 0 1116 0v5h-.582m0-5.001L12 13.414l1.723-1.723a2.998 2.998 0 014.177 0L20 13V9" />
                </svg>
                <span>REGENERATE</span>
              </button>
              <div className="h-3 w-[2px] bg-primary/20" />
            </>
          )}
          
          {/* Like/Dislike buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Like message
                console.log('Liked message:', message.id);
              }}
              className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground hover:text-green-500 uppercase transition-colors"
            >
              ♥
            </button>
            <button
              onClick={() => {
                // Dislike message
                console.log('Disliked message:', message.id);
              }}
              className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground hover:text-red-500 uppercase transition-colors"
            >
              ♦
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
});

MessageBubble.displayName = 'MessageBubble';

function StreamingMessage({ content }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col w-full gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground px-1">
        ASSISTANT
      </span>
      <div className="max-w-[85%] border-2 border-primary bg-background text-foreground px-5 py-4">
        <div className="prose prose-slate max-w-none dark:prose-invert prose-table:my-4 prose-td:px-3 prose-td:py-2 prose-th:px-3 prose-th:py-2 prose-tr:border-b prose-tr:border-primary/20">
          <ReactMarkdown components={{
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const inline = !match;
              return !inline && match ? (
                <CodeBlock
                  language={match[1]}
                  children={children}
                  className="my-2"
                />
              ) : (
                <code className="bg-muted/30 px-1.5 py-0.5 font-mono text-[13px] border border-primary/20 rounded" {...props}>
                  {children}
                </code>
              );
            },
          }}>
          {content}
          </ReactMarkdown>
          <span className="inline-block w-2.5 h-4 bg-primary ml-1 animate-pulse align-middle" />
        </div>
      </div>
    </motion.div>
  );
}
