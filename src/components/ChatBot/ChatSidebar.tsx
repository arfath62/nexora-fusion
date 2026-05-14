import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, Squircle, CirclePlus, Star, Trash2 } from 'lucide-react';

interface ChatHistory {
  id: string;
  title: string;
  date: Date;
  isFavorite?: boolean;
}

interface ChatSidebarProps {
  chats: ChatHistory[];
  activeChatId: string;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onToggleFavorite: (chatId: string) => void;
}

export default function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onToggleFavorite,
}: ChatSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Group chats by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const todayChats = chats.filter(chat => {
    const chatDate = new Date(chat.date);
    chatDate.setHours(0, 0, 0, 0);
    return chatDate.getTime() === today.getTime();
  });

  const yesterdayChats = chats.filter(chat => {
    const chatDate = new Date(chat.date);
    chatDate.setHours(0, 0, 0, 0);
    return chatDate.getTime() === yesterday.getTime();
  });

  const olderChats = chats.filter(chat => {
    const chatDate = new Date(chat.date);
    chatDate.setHours(0, 0, 0, 0);
    return chatDate.getTime() < yesterday.getTime();
  });

  return (
    <motion.div 
      className="h-full w-72 border-r border-white/10 bg-black/20 backdrop-blur-xl"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-4">
        <button 
          className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 transition-colors"
          onClick={onNewChat}
        >
          <CirclePlus size={18} />
          <span>New chat</span>
        </button>
      </div>
      
      <div className="h-[calc(100%-72px)] overflow-y-auto px-3 pb-4">
        {/* Pinned chats */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-400">
            <span>Pinned</span>
            <button onClick={() => setIsCollapsed(!isCollapsed)}>
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
          
          {!isCollapsed && (
            <div>
              {chats
                .filter(chat => chat.isFavorite)
                .map(chat => (
                  <div 
                    key={chat.id}
                    className={`flex items-center p-2 rounded-lg cursor-pointer group ${
                      activeChatId === chat.id ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <Star size={14} className="flex-shrink-0 text-yellow-400" />
                    <span className="ml-2 text-sm text-white truncate">{chat.title}</span>
                    <div className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 flex gap-1">
                      <button
                        className="p-1 rounded hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(chat.id);
                        }}
                      >
                        <Squircle size={14} className="text-gray-400" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(chat.id);
                        }}
                      >
                        <Trash2 size={14} className="text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
        
        {/* Today's chats */}
        {todayChats.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1.5 text-sm text-gray-400">Today</div>
            {todayChats.map(chat => (
              <div 
                key={chat.id}
                className={`flex items-center p-2 rounded-lg cursor-pointer group ${
                  activeChatId === chat.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onClick={() => onSelectChat(chat.id)}
              >
                <Clock size={14} className="flex-shrink-0 text-gray-400" />
                <span className="ml-2 text-sm text-white truncate">{chat.title}</span>
                <div className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 flex gap-1">
                  <button
                    className="p-1 rounded hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(chat.id);
                    }}
                  >
                    <Star size={14} className="text-gray-400" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                  >
                    <Trash2 size={14} className="text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Yesterday's chats */}
        {yesterdayChats.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1.5 text-sm text-gray-400">Yesterday</div>
            {yesterdayChats.map(chat => (
              <div 
                key={chat.id}
                className={`flex items-center p-2 rounded-lg cursor-pointer group ${
                  activeChatId === chat.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onClick={() => onSelectChat(chat.id)}
              >
                <Clock size={14} className="flex-shrink-0 text-gray-400" />
                <span className="ml-2 text-sm text-white truncate">{chat.title}</span>
                <div className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 flex gap-1">
                  <button
                    className="p-1 rounded hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(chat.id);
                    }}
                  >
                    <Star size={14} className="text-gray-400" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                  >
                    <Trash2 size={14} className="text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Older chats */}
        {olderChats.length > 0 && (
          <div>
            <div className="px-2 py-1.5 text-sm text-gray-400">Previous 7 Days</div>
            {olderChats.map(chat => (
              <div 
                key={chat.id}
                className={`flex items-center p-2 rounded-lg cursor-pointer group ${
                  activeChatId === chat.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onClick={() => onSelectChat(chat.id)}
              >
                <Clock size={14} className="flex-shrink-0 text-gray-400" />
                <span className="ml-2 text-sm text-white truncate">{chat.title}</span>
                <div className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 flex gap-1">
                  <button
                    className="p-1 rounded hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(chat.id);
                    }}
                  >
                    <Star size={14} className="text-gray-400" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                  >
                    <Trash2 size={14} className="text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
