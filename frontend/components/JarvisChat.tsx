import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, X, MessageSquare, Mic, MicOff, Volume2, VolumeX, 
  BookOpen, HelpCircle, Lightbulb, GraduationCap, Flame
} from 'lucide-react';
import { chatWithAssistant, ChatMessage } from '../services/aiService';
import { cn } from '../components/UIComponents';

export const JarvisChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'voice'>('text');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [voiceHistory, setVoiceHistory] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollChatToBottom = () => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollChatToBottom();
    }
  }, [history, isOpen]);

  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const voiceHistoryRef = useRef(voiceHistory);
  useEffect(() => {
    voiceHistoryRef.current = voiceHistory;
  }, [voiceHistory]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const speakText = (text: string, onEnd?: () => void) => {
    if (isMutedRef.current || !('speechSynthesis' in window)) {
       if (onEnd) onEnd();
       return;
    }
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean markdown so it sounds natural
    const cleanText = text.replace(/[*_#]/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || voices.find(v => v.lang.startsWith('en'));
    if (preferredVoice) utterance.voice = preferredVoice;
    
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        
        const isVoiceMode = activeTabRef.current === 'voice';
        
        if (!isVoiceMode) {
          setInputValue(transcript);
        }
        
        const latestHistory = isVoiceMode ? voiceHistoryRef.current : historyRef.current;
        const updatedHistory: ChatMessage[] = [
          ...latestHistory,
          { role: 'user', text: transcript }
        ];
        
        if (!isVoiceMode) {
          setHistory(updatedHistory);
        } else {
          setVoiceHistory(updatedHistory);
        }
        setIsLoading(true);

        let context = "You are IntelliPrep's smart AI study copilot. Help the student succeed by providing well-grouped explanations, clear summaries, adaptive learning tips, and encouragement.";
        if (isVoiceMode) {
          context = "You are IntelliPrep's smart AI voice tutor having a live voice conversation. Be extremely natural, conversational, use filler words occasionally, keep responses short (1-2 sentences max), do not use any markdown lists or symbols, just plain spoken text.";
        }
        
        chatWithAssistant(context, updatedHistory, transcript).then(reply => {
          const finalHistory = [
             ...updatedHistory,
             { role: 'model', text: reply }
          ];
          
          if (!isVoiceMode) {
            setHistory(finalHistory);
          } else {
            setVoiceHistory(finalHistory);
          }
          setIsLoading(false);
          speakText(reply, () => {
            // Automatically restart listening if in voice mode
            if (activeTabRef.current === 'voice') {
              try {
                recognitionRef.current?.start();
                setIsListening(true);
              } catch (e) {
                console.error("Auto-restart recognition error", e);
              }
            }
          });
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
      }
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      window.speechSynthesis.cancel(); // Stop talking when user starts listening
      setInputValue(''); // Clear input for fresh dictation
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Speech recognition error:", e);
      }
    }
  };

  const handleSendChatDirect = async (msg: string) => {
    if (!msg.trim()) return;

    setInputValue('');
    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: 'user', text: msg }
    ];
    setHistory(updatedHistory);
    setIsLoading(true);

    const context = "You are IntelliPrep's smart AI study copilot. Help the student succeed by providing well-grouped explanations, clear summaries, adaptive learning tips, and encouragement.";
    const reply = await chatWithAssistant(context, updatedHistory, msg);
    
    setHistory([
      ...updatedHistory,
      { role: 'model', text: reply }
    ]);
    setIsLoading(false);
    speakText(reply);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    handleSendChatDirect(inputValue);
  };

  const PRESET_SUGGESTIONS = [
    { text: "Help me study definitions", icon: BookOpen, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" },
    { text: "Give me a quick 3-question quiz", icon: HelpCircle, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30" },
    { text: "Explain with a practical example", icon: Lightbulb, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" },
    { text: "Study strategies for exams", icon: GraduationCap, color: "text-teal-500 bg-teal-50 dark:bg-teal-950/30" }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="w-[360px] md:w-[400px] h-[580px] bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4 border border-slate-200/80 dark:border-slate-800/80 animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Header Gradient */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-950 p-4 pb-3 flex flex-col justify-between shadow-md border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center shadow-inner relative">
                  <Bot size={20} className="text-white animate-pulse" />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900"></div>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                    IntelliPrep Copilot
                    <span className="text-[10px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded-full font-bold">AI</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Ready to boost your study session</p>
                </div>
              </div>
              <div className="flex gap-1.5 items-center">
                <button 
                  onClick={() => setIsMuted(!isMuted)} 
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                  title={isMuted ? "Unmute Voice" : "Mute Voice"}
                >
                  {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                  title="Close Assistant"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            {/* Minimal Modern Tabs */}
            <div className="flex gap-4 px-1 mt-2">
              <button 
                onClick={() => setActiveTab('text')}
                className={cn(
                  "pb-1.5 text-xs font-bold transition-all relative outline-none", 
                  activeTab === 'text' ? "text-white" : "text-white/60 hover:text-white"
                )}
              >
                Text Study Copilot
                {activeTab === 'text' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-t-full"></div>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('voice')}
                className={cn(
                  "pb-1.5 text-xs font-bold transition-all relative outline-none", 
                  activeTab === 'voice' ? "text-white" : "text-white/60 hover:text-white"
                )}
              >
                Live Interactive Voice
                {activeTab === 'voice' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-t-full"></div>
                )}
              </button>
            </div>
          </div>
          
          {activeTab === 'text' ? (
            <>
              {/* Chat Message Scrollport */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
                {history.length === 0 && (
                  <div className="py-8 px-4 text-center flex flex-col items-center justify-center h-full">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-555/20 mb-4 transform hover:scale-105 transition-transform duration-300">
                      <Bot size={30} className="animate-bounce" />
                    </div>
                    <h4 className="text-sm font-black text-gray-800 dark:text-gray-100">Intelligent Study Session</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 max-w-[260px] leading-relaxed mx-auto">
                      Ask me to organize a customized study plan, quiz you on your lecture materials, or simplify complex topics!
                    </p>

                    {/* Beautiful Suggestions Grid */}
                    <div className="mt-6 w-full space-y-2 text-left">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 px-1">Quick Actions</span>
                      <div className="grid grid-cols-2 gap-2">
                        {PRESET_SUGGESTIONS.map((sug, sKey) => {
                          const IconComp = sug.icon;
                          return (
                            <button
                              key={sKey}
                              onClick={() => handleSendChatDirect(sug.text)}
                              className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 hover:border-emerald-200 transition-all text-left flex gap-2 items-start text-[11px] font-medium text-slate-700 dark:text-slate-300 shadow-sm"
                            >
                              <IconComp size={15} className={cn("shrink-0 mt-0.5", sug.color)} />
                              <span className="leading-tight">{sug.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                
                {history.map((msg, idx) => (
                  <div key={idx} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start animate-in slide-in-from-left-2 duration-200")}>
                    <div className="flex gap-2.5 items-start max-w-[85%]">
                      {msg.role !== 'user' && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm text-[10px] font-bold">
                          A
                        </div>
                      )}
                      <div className={cn(
                        "px-4 py-2.5 text-xs leading-relaxed shadow-sm break-words border",
                        msg.role === 'user' 
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl rounded-tr-none border-emerald-500/35" 
                          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-none border-slate-200/80 dark:border-slate-800"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex w-full justify-start items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm text-[10px] font-bold">
                      A
                    </div>
                    <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5 float-left">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{animationDelay: '0.15s'}}></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{animationDelay: '0.3s'}}></div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Dock */}
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
                <form onSubmit={handleSendChat} className="flex flex-col gap-2 relative">
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      placeholder={isListening ? "Listening silently..." : "Ask Copilot anything..."}
                      className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs rounded-xl pl-4 pr-10 py-2.5 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-800 dark:text-slate-100 transition-all"
                    />
                    <button 
                      type="button"
                      onClick={toggleListen}
                      className={cn("p-2.5 rounded-xl transition-all flex-shrink-0 transform active:scale-95 shadow-sm border", 
                        isListening 
                          ? "bg-red-500 border-red-600 text-white animate-pulse" 
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      )}
                      title={isListening ? "Stop listening" : "Dictate message"}
                    >
                      {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                    <button 
                      type="submit" 
                      disabled={isLoading || !inputValue.trim()}
                      className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0 transform active:scale-95 shadow-md shadow-emerald-500/10 disabled:shadow-none"
                    >
                      <Send size={14} className="ml-0.5" />
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* Immersive Futuristic Live Voice Room */
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 dark:bg-slate-950/100 border-t border-slate-800 rounded-b-2xl relative overflow-hidden p-6 text-center">
              
              {/* Dynamic Soundwaves Rings in absolute layer */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 {isListening && (
                    <>
                      <div className="w-56 h-56 border border-emerald-500/30 rounded-full animate-ping opacity-30 absolute"></div>
                      <div className="w-72 h-72 border border-teal-500/20 rounded-full animate-ping opacity-20 absolute delay-150"></div>
                      <div className="w-96 h-96 border border-emerald-500/15 rounded-full animate-ping opacity-10 absolute delay-300"></div>
                      <div className="w-40 h-40 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-emerald-500/5 rounded-full animate-pulse absolute"></div>
                    </>
                 )}
                 {isLoading && !isListening && (
                   <div className="flex gap-1.5 opacity-60">
                     <div className="w-2.5 h-10 bg-emerald-500 rounded-full animate-pulse"></div>
                     <div className="w-2.5 h-14 bg-teal-500 rounded-full animate-pulse" style={{animationDelay: "150ms"}}></div>
                     <div className="w-2.5 h-8 bg-emerald-400 rounded-full animate-pulse" style={{animationDelay: "300ms"}}></div>
                   </div>
                 )}
              </div>
              
              <div className="z-10 mb-8 max-w-[240px] space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-white text-[10px] font-black tracking-wider uppercase">
                  <div className={cn("w-2 h-2 rounded-full", isListening ? "bg-red-500 animate-ping" : "bg-indigo-400")}></div>
                  {isListening ? "LINK LIVE ACTIVE" : "VOICE SESSION LINKED"}
                </div>
                
                <h4 className="text-base font-black text-white">Live AI Voice Tutor</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isListening ? "Listening intently... Speak anytime." 
                   : isLoading ? "Formulating spoken response..." 
                   : "Tap the custom microphone orb to start a seamless spoken learning dialogue."}
                </p>
              </div>

              {/* Pulsing Core microphone button */}
              <button 
                onClick={toggleListen}
                disabled={isLoading}
                className={cn(
                  "z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 border cursor-pointer",
                  isListening 
                    ? "bg-gradient-to-tr from-red-500 to-rose-600 border-red-400 shadow-red-500/40 text-white animate-pulse" 
                    : isLoading 
                      ? "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 border-emerald-400/30 shadow-emerald-555/30 text-white hover:shadow-emerald-500/50"
                )}
              >
                {isListening ? <MicOff size={34} /> : <Mic size={34} />}
              </button>

              <div className="mt-8 z-10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Natural Hands-Free Mode</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trigger Orb button */}
      <div className="relative group">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer z-10 relative",
            isOpen ? "rotate-90 hover:from-slate-700 hover:to-slate-800" : ""
          )}
          title={isOpen ? "Close Assistant" : "Open Intelli Companion"}
        >
          {isOpen ? <X size={22} /> : <MessageSquare size={22} className="fill-white" />}
        </button>
        {isListening && (
          <div className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-60 z-0"></div>
        )}
        {!isOpen && (
          <div className="absolute inset-x-auto right-16 top-1/2 -translate-y-1/2 p-2 px-3 rounded-xl bg-slate-900 text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-md">
            Study Copilot is here!
          </div>
        )}
      </div>
    </div>
  );
};
