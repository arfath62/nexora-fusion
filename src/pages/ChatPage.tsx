import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ChatSidebar from '../components/ChatBot/ChatSidebar';
import ChatMessage from '../components/ChatBot/ChatMessage';
import ChatInput, { ChatAttachment } from '../components/ChatBot/ChatInput';
import databaseService from '../services/DatabaseService';
import { getApiBaseUrl, getStoredAccessToken } from '../lib/apiEnv';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: ChatAttachment[];
}

interface ChatSession {
  id: string;
  title: string;
  date: Date;
  isFavorite?: boolean;
}

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: "Hello! I'm Nexora AI, your advanced AI assistant. How can I help you today?",
    timestamp: new Date(2025, 5, 25, 11, 30),
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>('chat-default');
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
    { id: 'chat-default', title: 'Welcome chat', date: new Date(), isFavorite: true },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (content: string, attachments: ChatAttachment[] = []) => {
    const promptContent = attachments.length
      ? `${content}\n\nAttachments:\n${attachments
          .map((file) => `- ${file.name} (${file.type || 'file'}, ${(file.size / 1024).toFixed(1)} KB)`)
          .join('\n')}`.trim()
      : content;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content || (attachments.length ? 'Uploaded attachment' : ''),
      timestamp: new Date(),
      attachments,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    setChatSessions((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        const title = chat.title === 'New conversation' ? (content || attachments[0]?.name || 'Uploaded attachment').slice(0, 40) : chat.title;
        return {
          ...chat,
          title: title || 'Untitled conversation',
          date: new Date(),
        };
      })
    );
    
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, aiMessage]);

    try {
      const allMessages = [...messages, { ...userMessage, content: promptContent }];
      const apiBaseUrl = getApiBaseUrl();
      if (!apiBaseUrl) throw new Error('API is not configured');
      const token = getStoredAccessToken();
      
      const response = await fetch(`${apiBaseUrl}/api/chat/sessions/${currentChatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: allMessages.map((message) => ({
            ...message,
            timestamp: message.timestamp.toISOString(),
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to stream response');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              setIsProcessing(false);
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: msg.content + data.text } 
                    : msg
                ));
              } else if (data.error) {
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: msg.content + '\n\n**Error**: ' + data.error } 
                    : msg
                ));
              }
            } catch (e) {
              // Ignore parse errors from partial chunks
            }
          }
        }
      }
      setIsProcessing(false);
    } catch (error) {
      console.error('Streaming error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: msg.content + '\n\n*(Connection error during streaming)*' } 
          : msg
      ));
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const loadChatSessions = async () => {
      try {
        const items = await databaseService.getAllChats();
        if (items.length === 0) return;

        const sessions: ChatSession[] = items
          .map((item) => ({
            id: item.id,
            title: item.title || item.messages?.[0]?.content?.slice(0, 30) || 'Conversation',
            date: new Date(item.updatedAt ?? Date.now()),
            isFavorite: item.isFavorite ?? false,
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        setChatSessions(sessions);
        setCurrentChatId(sessions[0].id);
      } catch (error) {
        console.error('Error loading chat sessions:', error);
      }
    };

    loadChatSessions();
  }, []);

  useEffect(() => {
    // Load chat messages from database when component mounts
    const loadChatHistory = async () => {
      try {
        const savedMessages = await databaseService.getChat(currentChatId);
        if (savedMessages && savedMessages.length > 0) {
          // Convert string dates back to Date objects
          const processedMessages = savedMessages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(processedMessages);
        } else {
          setMessages(initialMessages);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };
    
    loadChatHistory();
  }, [currentChatId]);

  useEffect(() => {
    // Save messages to database whenever they change
    const saveMessages = async () => {
      try {
        if (messages.length > 0) {
          const currentSession = chatSessions.find((chat) => chat.id === currentChatId);
          await databaseService.saveChat(
            currentChatId,
            messages.map((message) => ({
              ...message,
              timestamp: message.timestamp.toISOString(),
              title: currentSession?.title || 'Conversation',
              isFavorite: currentSession?.isFavorite ?? false,
            }))
          );
        }
      } catch (error) {
        console.error('Error saving chat messages:', error);
      }
    };
    
    saveMessages();
  }, [messages, currentChatId, chatSessions]);

  const handleNewChat = () => {
    const id = `chat-${Date.now()}`;
    const newChat: ChatSession = {
      id,
      title: 'New conversation',
      date: new Date(),
    };

    setChatSessions((prev) => [newChat, ...prev]);
    setCurrentChatId(id);
    setMessages(initialMessages);
  };

  const handleDeleteChat = async (chatId: string) => {
    const nextChats = chatSessions.filter((chat) => chat.id !== chatId);
    setChatSessions(nextChats);
    await databaseService.deleteChat(chatId);

    if (chatId === currentChatId) {
      if (nextChats.length > 0) {
        setCurrentChatId(nextChats[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  const handleToggleFavorite = (chatId: string) => {
    setChatSessions((prev) =>
      prev.map((chat) => (chat.id === chatId ? { ...chat, isFavorite: !chat.isFavorite } : chat))
    );
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="h-full flex">
      <ChatSidebar
        chats={chatSessions}
        activeChatId={currentChatId}
        onSelectChat={setCurrentChatId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onToggleFavorite={handleToggleFavorite}
      />
      
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Welcome header */}
            <motion.div 
              className="pt-8 pb-6 px-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">Nexora AI Assistant</h1>
              <p className="mt-2 text-gray-400">Ask me anything about technology, programming, data analysis, or creative projects.</p>
            </motion.div>
            
            {/* Chat messages */}
            <div className="pb-4 divide-y divide-white/5">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {isProcessing && (
                <div className="flex gap-4 p-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-600">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="font-medium text-sm text-white">Nexora AI</h4>
                    </div>
                    <div className="mt-1 text-gray-200">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse animation-delay-200" />
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse animation-delay-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>
        
        <ChatInput onSendMessage={handleSendMessage} isProcessing={isProcessing} />
      </div>
    </div>
  );
}
