import { motion } from 'framer-motion';
import { Bot, FileText, User } from 'lucide-react';
import { ChatAttachment } from './ChatInput';

interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    attachments?: ChatAttachment[];
  };
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <motion.div 
      className={`flex gap-4 p-4 ${isUser ? '' : 'bg-white/5'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center
                        ${isUser 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600' 
                          : 'bg-gradient-to-r from-purple-500 to-pink-600'}`}>
          {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
        </div>
      </div>
      
      <div className="flex-1">
        <div className="flex items-center">
          <h4 className="font-medium text-sm text-white">
            {isUser ? 'You' : 'Nexora AI'}
          </h4>
          <span className="ml-2 text-xs text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        <div className="mt-1 text-gray-200 whitespace-pre-wrap">
          {message.content}
        </div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-3 grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
            {message.attachments.map((file) => (
              <div key={file.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
                {file.dataUrl ? (
                  <img src={file.dataUrl} alt={file.name} className="max-h-56 w-full object-cover" />
                ) : (
                  <div className="flex items-center gap-2 p-3 text-sm text-gray-200">
                    <FileText size={16} className="shrink-0 text-gray-400" />
                    <span className="min-w-0 truncate">{file.name}</span>
                  </div>
                )}
                <div className="border-t border-white/10 px-3 py-2 text-xs text-gray-400">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
