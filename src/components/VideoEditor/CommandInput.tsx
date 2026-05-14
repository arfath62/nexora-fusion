import { useState, useRef, useEffect } from 'react';
import { Mic, Send, Terminal } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface CommandInputProps {
  onSubmit: (command: string) => void;
  isProcessing: boolean;
}

export default function CommandInput({ onSubmit, isProcessing }: CommandInputProps) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const exampleCommands = [
    'cut clip from 0:10 to 0:30',
    'add text "Awesome video" at 0:15 for 5 seconds',
    'apply slow motion effect to clip between 0:20 and 0:40',
    'add fade transition between clips at 0:30',
    'zoom in on center from 0:45 to 0:50',
    'change brightness to +20% for entire video',
    'add background music "Energetic" at 40% volume',
    'normalize audio levels across all clips',
    'add captions from transcript.txt',
    'export in 4K resolution at high quality',
  ];
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim() && !isProcessing) {
      onSubmit(command);
      setHistory([...history, command]);
      setHistoryIndex(-1);
      setCommand('');
      setSuggestions([]);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setCommand(history[history.length - 1 - newIndex] || '');
    } else if (e.key === 'ArrowDown' && historyIndex > -1) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCommand(newIndex >= 0 ? history[history.length - 1 - newIndex] : '');
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      setCommand(suggestions[0]);
      setSuggestions([]);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCommand(value);
    
    // Simple command suggestions
    if (value.trim()) {
      const matchedSuggestions = exampleCommands.filter(cmd => 
        cmd.toLowerCase().startsWith(value.toLowerCase()) && cmd !== value
      );
      setSuggestions(matchedSuggestions.slice(0, 3));
    } else {
      setSuggestions([]);
    }
  };
  
  return (
    <div className="border-t border-white/10 bg-black/40 px-4 py-3">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div className="mb-2 flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Terminal size={14} className="text-indigo-400" />
            <span className="text-sm font-medium text-white">Video Command</span>
          </div>
          
          {suggestions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Suggestions:</span>
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-300 hover:bg-indigo-500/20 hover:text-white"
                  onClick={() => {
                    setCommand(suggestion);
                    setSuggestions([]);
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="relative rounded-lg border border-white/10 bg-black/50 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none p-3">
            <SyntaxHighlighter
              language="bash"
              style={atomOneDark}
              customStyle={{
                background: 'transparent',
                padding: 0,
                margin: 0,
                fontSize: '0.875rem',
                opacity: command ? 1 : 0.5
              }}
            >
              {command || '# Type a command like "cut clip from 0:10 to 0:30"'}
            </SyntaxHighlighter>
          </div>
          
          <textarea
            ref={inputRef}
            value={command}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a command like 'cut clip from 0:10 to 0:30'"
            className="w-full p-3 bg-transparent text-transparent caret-white resize-none focus:outline-none h-[72px]"
            disabled={isProcessing}
            style={{ caretColor: 'white' }}
          />
          
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button 
              type="button" 
              className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
              title="Voice command"
            >
              <Mic size={16} />
            </button>
            <button 
              type="submit" 
              className={`p-1.5 rounded-full 
                ${command.trim() && !isProcessing
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'text-gray-400 bg-white/5 cursor-not-allowed'}`}
              disabled={!command.trim() || isProcessing}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
        
        <div className="mt-3">
          <div className="text-xs text-gray-400 mb-2">Examples:</div>
          <div className="flex flex-wrap gap-2">
            {exampleCommands.slice(0, 5).map((cmd, i) => (
              <button
                key={i}
                type="button"
                className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setCommand(cmd);
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }}
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
