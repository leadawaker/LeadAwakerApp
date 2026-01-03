import { motion, useInView } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface Message {
  type: "agent" | "user" | "system";
  sender?: string;
  content?: string;
  time?: string;
  id?: string;
}

export default function ChatCard2D({ messages, themeColor = "#2563EB" }: { messages?: Message[], themeColor?: string }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.5 });

  const defaultMessages: Message[] = [
    { type: "agent", sender: "Sophie", content: "Hi, this is Sophie from Sterling Finance, is this Jack who wanted to check if they were owed a refund on their car finance?", time: "14:35" },
    { type: "system", content: "Lead Contacted", id: "s1" },
    { type: "agent", sender: "Sophie", content: "just bumping this up in case you got busy before :)", time: "14:55" },
    { type: "user", sender: "Jack", content: "Hi, yes", time: "15:00" },
    { type: "system", content: "Lead Replied", id: "s2" },
    { type: "user", sender: "Jack", content: "I would like to check. I had 2 cars on finance 5 years ago", time: "15:01" },
    { type: "system", content: "Lead Qualified", id: "s3" },
    { type: "agent", sender: "Sophie", content: "That's great Jack! Do you happen to have your vehicle finance agreement documents handy for those cars?", time: "15:04" },
    { type: "user", sender: "Jack", content: "No sorry", time: "15:05" },
    { type: "user", sender: "Jack", content: "Not at Hand", time: "15:05" },
    { type: "agent", sender: "Sophie", content: "No worries at all Jack. We can actually submit a Data Subject Access Request (DSAR) on your behalf to get those documents for you. Could you please complete this short DSAR form by clicking on this URL https://www.dsarform.com/lead315 ?", time: "15:09" },
    { type: "user", sender: "Jack", content: "What is the process from here?", time: "15:20" },
    { type: "user", sender: "Jack", content: "Do you let me know if I'm eligible to make a claim once you retrieve the docs and then I confirm I want to proceed?", time: "15:20" },
    { type: "agent", sender: "Sophie", content: "Absolutely, Jack. Once you've completed the DSAR form, we'll request your vehicle finance agreement and review it. If we find that you're eligible for a claim, we'll get in touch with you to discuss the next steps. It typically takes us about 30 working days to get everything sorted. Remember, we operate on a no-win no fee basis, so there's no risk to you. Just pop over to the URL and fill out the form when you can https://www.dsarform.com/lead315", time: "15:22" },
    { type: "user", sender: "Jack", content: "Thanks.", time: "15:24" },
    { type: "system", content: "DSAR Completed", id: "s4" },
    { type: "agent", sender: "Sophie", content: "Jack, thanks for filling your claim, you will hear from us soon. Any further questions, feel free to ask", time: "15:39" },
    { type: "user", sender: "Jack", content: "No, that is all from me", time: "15:40" },
    { type: "system", content: "Sent To Client", id: "s5" },
    { type: "agent", sender: "Sophie", content: "Ok Jack, we hope you have a great day :)", time: "15:41" }
  ];

  const chatMessages = messages || defaultMessages;

  const headerName = chatMessages.find(msg => msg.type === 'user')?.sender?.split(' ')[0] || "Augusto";

  const isAtBottom = useCallback(() => {
    if (!scrollRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    return scrollTop + clientHeight >= scrollHeight - 10;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current || !isAnimating) return;
      const atBottom = isAtBottom();
      setIsUserScrolling(!atBottom);
      setShowNewMessageIndicator(!atBottom && currentStep > 5);
    };
    const currentScrollRef = scrollRef.current;
    currentScrollRef?.addEventListener("scroll", handleScroll);
    return () => currentScrollRef?.removeEventListener("scroll", handleScroll);
  }, [isAnimating, currentStep, isAtBottom]);

  useEffect(() => {
    if (currentStep > 0 && scrollRef.current && (!isUserScrolling || isAtBottom())) {
      scrollToBottom();
    }
  }, [currentStep, isAtBottom, scrollToBottom, isUserScrolling]);

  useEffect(() => {
    if (isInView && currentStep === 0) {
      const loadMessages = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        setCurrentStep(1);
        await new Promise(resolve => setTimeout(resolve, 800));
        setCurrentStep(2);
        await new Promise(resolve => setTimeout(resolve, 800));
        setCurrentStep(3);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setCurrentStep(4);
        await new Promise(resolve => setTimeout(resolve, 800));
        setCurrentStep(5);
      };
      loadMessages();
    }
  }, [isInView, currentStep]);

  useEffect(() => {
    setCurrentStep(0);
    setIsAnimating(false);
  }, [messages]);

  const startAnimation = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsUserScrolling(false);
    for (let i = 6; i <= chatMessages.length; i++) {
      setCurrentStep(i);
      
      const message = chatMessages[i-1];
      let delay = 1000; // Minimum 1s delay
      
      if (message && message.content && (message.type === 'agent' || message.type === 'user')) {
        // Calculate delay based on character count (excluding spaces and newlines)
        const charCount = message.content.replace(/\s/g, '').length;
        const calculatedDelay = charCount * 80;
        delay = Math.max(1000, calculatedDelay);
      } else if (message && message.type === 'system') {
        delay = 800; // Standard system message delay
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    setIsAnimating(false);
    setShowNewMessageIndicator(false);
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
  };

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto relative">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
        <div className="p-4 flex items-center gap-3" style={{ backgroundColor: themeColor }}>
          <div className="rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ width: "44px", height: "44px", backgroundColor: "#6B6B6B" }}>
            {headerName[0]}
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">{headerName}</h3>
            <p className="text-xs flex items-center gap-1" style={{ color: "#FCC700" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#FCC700" }} />
              Online
            </p>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="p-6 space-y-4 bg-slate-50 h-[600px] overflow-y-auto relative"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="relative z-10 space-y-4">
            {chatMessages.slice(0, currentStep).map((msg, idx) => (
              <div key={msg.id || idx}>
                {msg.type === 'system' ? (
                  <motion.div className="flex justify-center py-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="text-xs text-slate-400 font-medium">--- {msg.content} ---</div>
                  </motion.div>
                ) : (
                  <motion.div className={`flex ${msg.type === 'agent' ? 'justify-end' : 'justify-start'}`} variants={messageVariants} initial="hidden" animate="visible">
                    <div className={`flex flex-col ${msg.type === 'agent' ? 'items-end' : 'items-start'} gap-1 max-w-[85%]`}>
                      <div className={`rounded-2xl px-4 py-3 shadow-sm text-sm relative pb-6 ${msg.type === 'agent' ? 'text-white rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm'}`} style={msg.type === 'agent' ? { backgroundColor: themeColor } : {}}>
                        {msg.content?.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                        <span className={`absolute bottom-1 right-3 text-[10px] ${msg.type === 'agent' ? 'text-white/70' : 'text-slate-400'}`}>
                          {msg.time}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
            {isAnimating && currentStep < chatMessages.length && (
              <div className="flex justify-start items-center gap-3">
                <div className="bg-slate-200 rounded-full px-4 py-2 flex gap-1">
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }}>•</motion.span>
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}>•</motion.span>
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}>•</motion.span>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isAnimating && currentStep < chatMessages.length && (
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-center">
            <Button onClick={startAnimation} className="rounded-xl px-8" style={{ backgroundColor: themeColor }}>
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
