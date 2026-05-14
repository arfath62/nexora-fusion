import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
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
      </div>
    </motion.div>
  );
}
