import { useState, FormEvent, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Image, Mic, Paperclip, Send } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
}

export default function ChatInput({ onSendMessage, isProcessing }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isProcessing) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <motion.div 
      className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
        <div className="relative rounded-lg border border-white/10 bg-white/5 overflow-hidden">
          <div className="flex items-end">
            <TextareaAutosize
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              className="w-full p-3 pr-20 bg-transparent text-white placeholder-gray-400 resize-none focus:outline-none max-h-40"
              minRows={1}
              maxRows={6}
              disabled={isProcessing}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button 
                type="button" 
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                title="Attach files"
              >
                <Paperclip size={16} />
              </button>
              <button 
                type="button" 
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                title="Upload image"
              >
                <Image size={16} />
              </button>
              <button 
                type="button" 
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                title="Voice input"
              >
                <Mic size={16} />
              </button>
              <button 
                type="submit" 
                className={`p-1.5 rounded-full 
                  ${message.trim() && !isProcessing
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'text-gray-400 bg-white/5 cursor-not-allowed'}`}
                disabled={!message.trim() || isProcessing}
                title="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 px-1 flex justify-between items-center text-xs text-gray-400">
          <span>Nexora AI can make mistakes. Consider verifying important information.</span>
          <span>{message.length} / 4000</span>
        </div>
      </form>
    </motion.div>
  );
}
