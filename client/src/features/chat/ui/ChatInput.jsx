import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/utils/utils';
import { Code, Bold, Italic, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

export function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Type a message...'
}) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const textareaRef = useRef(null);

  const handleSubmit = () => {
    if (message.trim() && !disabled && !isStreaming) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Show toolbar when user starts typing
    if (e.key.length === 1 || e.key === 'Backspace') {
      setShowToolbar(message.length > 0);
    }
  };

  const handleChange = e => {
    setMessage(e.target.value);
    setShowToolbar(e.target.value.length > 0);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  // Markdown formatting helpers
  const wrapText = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    const newText = message.substring(0, start) + before + selectedText + after + message.substring(end);
    
    setMessage(newText);
    
    // Move cursor to after the wrapped text
    setTimeout(() => {
      if (textarea) {
        textarea.selectionStart = textarea.selectionEnd = start + before.length + selectedText.length + after.length;
        textarea.focus();
        handleChange({ target: { value: newText } });
      }
    }, 0);
  };

  const insertMarkdown = (template) => {
    wrapText(template, '');
  };

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <TooltipProvider>
      <div className="w-full flex justify-center relative">
        <div className="w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="relative group"
          >
            {/* Markdown Toolbar (shows when typing) */}
            {showToolbar && !isStreaming && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-1 p-2 mb-2 border-2 border-primary/40 bg-muted/20 rounded overflow-x-auto"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-muted/30"
                      onClick={() => insertMarkdown('**')}
                    >
                      <Bold size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-none border-2 border-primary bg-background text-foreground text-xs font-mono">
                    Bold (Ctrl+B)
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-muted/30"
                      onClick={() => insertMarkdown('*')}
                    >
                      <Italic size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-none border-2 border-primary bg-background text-foreground text-xs font-mono">
                    Italic (Ctrl+I)
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-muted/30"
                      onClick={() => insertMarkdown('- ')}
                    >
                      <List size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-none border-2 border-primary bg-background text-foreground text-xs font-mono">
                    Bullet List
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-muted/30"
                      onClick={() => insertMarkdown('1. ')}
                    >
                      <ListOrdered size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-none border-2 border-primary bg-background text-foreground text-xs font-mono">
                    Numbered List
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-muted/30"
                      onClick={() => insertMarkdown('```\n\n```')}
                    >
                      <Code size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-none border-2 border-primary bg-background text-foreground text-xs font-mono">
                    Code Block
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-muted/30"
                      onClick={() => insertMarkdown('[](url)')}
                    >
                      <LinkIcon size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-none border-2 border-primary bg-background text-foreground text-xs font-mono">
                    Link
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            )}

            {/* Main Input Box - Brutalist */}
            <div className={cn(
              "relative flex items-end gap-2 border-2 p-2 w-full transition-colors",
              "bg-background",
              isFocused ? "border-primary" : "border-primary/40 hover:border-primary/60"
            )}>
              {/* Textarea */}
              <Textarea 
                ref={textareaRef} 
                value={message} 
                onChange={handleChange} 
                onKeyDown={handleKeyDown} 
                onFocus={() => setIsFocused(true)} 
                onBlur={() => setIsFocused(false)} 
                placeholder={placeholder} 
                disabled={disabled || isStreaming} 
                rows={1} 
                className={cn(
                  'flex-1 resize-none border-0 bg-transparent px-2 py-3 focus-visible:ring-0 focus-visible:ring-offset-0', 
                  'min-h-[44px] max-h-[200px] placeholder:text-muted-foreground', 
                  'text-[15px] text-foreground font-mono leading-relaxed custom-scrollbar rounded-none'
                )} 
              />

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pb-1 pr-1">
                <AnimatePresence mode="wait">
                  {isStreaming ? (
                    <motion.div key="stop" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                      <Button 
                        onClick={onStop} 
                        size="icon" 
                        className="h-10 w-10 rounded-none bg-primary text-primary-foreground hover:bg-foreground hover:text-background transition-colors active:scale-95"
                      >
                        <StopIcon sx={{ fontSize: 16 }} />
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div key="send" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-2">
                      {/* Keyboard Hint */}
                      {message.length > 0 && !disabled && (
                        <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-widest hidden sm:flex items-center gap-1">
                          Press <KeyboardReturnIcon sx={{ fontSize: 12 }} />
                        </span>
                      )}

                      <Button 
                        onClick={handleSubmit} 
                        disabled={!message.trim() || disabled} 
                        size="icon" 
                        className={cn(
                          "h-10 w-10 rounded-none transition-all duration-150", 
                          message.trim() 
                            ? "bg-primary text-primary-foreground hover:bg-foreground hover:text-background border-2 border-transparent" 
                            : "bg-muted/20 text-muted-foreground cursor-not-allowed border-2 border-transparent"
                        )}
                      >
                        <SendIcon sx={{ fontSize: 16 }} />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Subtle Footer Note */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] text-muted-foreground font-mono font-bold uppercase tracking-[0.2em]">
              AI WORKSPACE // 2026
            </motion.p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
