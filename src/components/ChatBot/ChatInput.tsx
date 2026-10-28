import { useState, FormEvent, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Image, Mic, Paperclip, Send, X } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: ChatAttachment[]) => void;
  isProcessing: boolean;
}

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
};

export default function ChatInput({ onSendMessage, isProcessing }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [inputStatus, setInputStatus] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceBaseMessageRef = useRef('');

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((message.trim() || attachments.length > 0) && !isProcessing) {
      onSendMessage(message.trim(), attachments);
      setMessage('');
      setAttachments([]);
      setInputStatus('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const addFiles = async (files: FileList | File[]) => {
    const next = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<ChatAttachment>((resolve) => {
            if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  dataUrl: String(reader.result),
                });
              reader.readAsDataURL(file);
              return;
            }
            resolve({
              id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
              name: file.name,
              type: file.type,
              size: file.size,
            });
          })
      )
    );
    setAttachments((prev) => [...prev, ...next]);
    setInputStatus(`${next.length} attachment${next.length === 1 ? '' : 's'} ready.`);
  };

  const startVoiceInput = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!window.isSecureContext) {
      setInputStatus('Voice input needs HTTPS or localhost. Start the app with npm run dev and open the localhost URL.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setInputStatus('Microphone access is not available in this browser.');
      return;
    }

    const SpeechRecognitionApi =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setInputStatus('Microphone access allowed, but speech-to-text is not supported in this browser.');
      } catch {
        setInputStatus('Microphone permission was blocked.');
      }
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) {
        setMessage(`${voiceBaseMessageRef.current}${voiceBaseMessageRef.current ? ' ' : ''}${transcript}`.trimStart());
      }
    };
    recognition.onerror = (event) => {
      const status =
        event.error === 'not-allowed'
          ? 'Microphone permission was blocked. Allow microphone access in the browser site settings.'
          : event.error === 'service-not-allowed'
            ? 'Speech recognition service is not available in this browser. Try Chrome or Edge.'
            : `Voice input failed: ${event.error}`;
      setInputStatus(status);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    voiceBaseMessageRef.current = message.trim();
    setInputStatus('Listening...');
    setIsListening(true);
    try {
      recognition.start();
    } catch (error) {
      setInputStatus(error instanceof Error ? `Voice input failed: ${error.message}` : 'Voice input failed to start.');
      setIsListening(false);
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
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          multiple
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <div className="relative rounded-lg border border-white/10 bg-white/5 overflow-hidden">
          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-b border-white/10 p-2">
              {attachments.map((file) => (
                <div key={file.id} className="flex min-w-0 items-center gap-2 rounded-md bg-black/30 px-2 py-1 text-xs text-gray-200">
                  {file.dataUrl ? (
                    <img src={file.dataUrl} alt="" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <FileText size={16} className="shrink-0 text-gray-400" />
                  )}
                  <span className="max-w-36 truncate">{file.name}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-gray-400 hover:bg-white/10 hover:text-white"
                    onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== file.id))}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                title="Attach files"
              >
                <Paperclip size={16} />
              </button>
              <button 
                type="button" 
                onClick={() => imageInputRef.current?.click()}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                title="Upload image"
              >
                <Image size={16} />
              </button>
              <button 
                type="button" 
                onClick={startVoiceInput}
                className={`p-1.5 rounded-full hover:text-white hover:bg-white/10 ${isListening ? 'bg-red-500/20 text-red-200' : 'text-gray-400'}`}
                title={isListening ? 'Stop voice input' : 'Voice input'}
              >
                <Mic size={16} />
              </button>
              <button 
                type="submit" 
                className={`p-1.5 rounded-full 
                  ${(message.trim() || attachments.length > 0) && !isProcessing
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'text-gray-400 bg-white/5 cursor-not-allowed'}`}
                disabled={(!message.trim() && attachments.length === 0) || isProcessing}
                title="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 px-1 flex justify-between items-center text-xs text-gray-400">
          <span>{inputStatus || 'Nexora AI can make mistakes. Consider verifying important information.'}</span>
          <span>{message.length} / 4000</span>
        </div>
      </form>
    </motion.div>
  );
}
