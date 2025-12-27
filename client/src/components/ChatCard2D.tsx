import { motion, useInView } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";

export default function ChatCard2D() {
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.5 });
  const previousScrollHeightRef = useRef(0);

  // Check if user is at bottom of scroll
  const isAtBottom = useCallback(() => {
    if (!scrollRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    return scrollTop + clientHeight >= scrollHeight - 10;
  }, []);

  // Scroll to bottom smoothly
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Handle scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current || !isAnimating) return;
      
      const atBottom = isAtBottom();
      setIsUserScrolling(!atBottom);
      
      if (!atBottom && currentStep > 5) {
        setShowNewMessageIndicator(true);
      } else {
        setShowNewMessageIndicator(false);
      }
    };

    const currentScrollRef = scrollRef.current;
    currentScrollRef?.addEventListener("scroll", handleScroll);
    return () => currentScrollRef?.removeEventListener("scroll", handleScroll);
  }, [isAnimating, currentStep, isAtBottom]);

  // Auto-scroll when at bottom, maintain position when scrolled up
  useEffect(() => {
    if (currentStep > 5 && scrollRef.current) {
      const wasAtBottom = isAtBottom();
      
      if (wasAtBottom || !isUserScrolling) {
        // User is at bottom - auto scroll down
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      }
      // If user scrolled up, don't do anything - let content stack below
    }
  }, [currentStep, isAtBottom, scrollToBottom, isUserScrolling]);

  // Sequentially load initial messages on view
  useEffect(() => {
    if (isInView && currentStep === 0) {
      const loadMessages = async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
        setCurrentStep(1);
        await new Promise(resolve => setTimeout(resolve, 1200));
        setCurrentStep(2);
        await new Promise(resolve => setTimeout(resolve, 1200));
        setCurrentStep(3);
        await new Promise(resolve => setTimeout(resolve, 1600));
        setCurrentStep(4);
        await new Promise(resolve => setTimeout(resolve, 1200));
        setCurrentStep(5);
      };
      loadMessages();
    }
  }, [isInView, currentStep]);

  const startAnimation = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsUserScrolling(false);
    
    // Jack's "No sorry" (0-3s)
    await new Promise(resolve => setTimeout(resolve, 3000));
    setCurrentStep(6);
    
    // Jack's "Not at Hand" (3-4.5s)
    await new Promise(resolve => setTimeout(resolve, 1500));
    setCurrentStep(7);
    
    // Sophie DSAR (4.5-10.25s) - half time earlier
    await new Promise(resolve => setTimeout(resolve, 5750));
    setCurrentStep(8);
    
    // Jack's first question (10.25-15.58s)
    await new Promise(resolve => setTimeout(resolve, 13000));
    setCurrentStep(9);
    
    // Jack's second question (15.58-17.58s)
    await new Promise(resolve => setTimeout(resolve, 2000));
    setCurrentStep(10);
    
    // Sophie final (17.58-22.25s) - 3x faster
    await new Promise(resolve => setTimeout(resolve, 4667));
    setCurrentStep(11);
    
    // Jack thanks (22.25-28.25s) - 6 seconds later
    await new Promise(resolve => setTimeout(resolve, 6000));
    setCurrentStep(12);
    
    // Sophie claim message (28.25-33.25s) - 2 seconds after DSAR Completed milestone (which appears 3s after Thanks)
    await new Promise(resolve => setTimeout(resolve, 5000));
    setCurrentStep(13);
    
    // Jack final message (50.5-52s)
    await new Promise(resolve => setTimeout(resolve, 1600));
    setCurrentStep(14);
    
    // Sophie closing message (52-53.5s)
    await new Promise(resolve => setTimeout(resolve, 1500));
    setCurrentStep(15);
    
    setIsAnimating(false);
    setShowNewMessageIndicator(false);
  };

  const scrollToBottomManually = () => {
    scrollToBottom();
    setShowNewMessageIndicator(false);
    setIsUserScrolling(false);
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.4 },
    },
  };

  const typingVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3 },
    },
  };

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto relative">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
        {/* Chat Header */}
        <div className="p-4 flex items-center gap-3" style={{ backgroundColor: "#2563EB" }}>
          <div className="rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ width: "44px", height: "44px", backgroundColor: "#6B6B6B" }}>
            J
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">Jack Johnson</h3>
            <p className="text-xs flex items-center gap-1" style={{ color: "#FCC700" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#FCC700" }} />
              Online
            </p>
          </div>
        </div>

        {/* Chat Messages Container */}
        <div 
          ref={scrollRef}
          className="p-6 space-y-4 bg-slate-50 h-[600px] overflow-y-auto relative"
          style={{ scrollBehavior: isUserScrolling ? 'auto' : 'smooth' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100/20 via-transparent to-slate-100/20 pointer-events-none" />
          
          <div className="relative z-10 space-y-4">
            {/* Message 1 - Sophie */}
            {currentStep >= 1 && (
              <motion.div className="flex justify-end" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Hi, this is Sophie from Sterling Finance, is this Jack who wanted to check if they were owed a refund on their car finance?
                  </div>
                  <span className="text-xs text-slate-400 pr-2">14:35</span>
                </div>
              </motion.div>
            )}

            {/* Milestone: Lead Contacted */}
            {currentStep >= 1 && (
              <motion.div 
                className="flex justify-center py-2" 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="text-xs text-slate-400 font-medium">---Lead Contacted---</div>
              </motion.div>
            )}

            {/* Message 2 - Sophie */}
            {currentStep >= 2 && (
              <motion.div className="flex justify-end" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    just bumping this up in case you got busy before :)
                  </div>
                  <span className="text-xs text-slate-400 pr-2">14:55</span>
                </div>
              </motion.div>
            )}

            {/* Message 3 - Jack */}
            {currentStep >= 3 && (
              <motion.div className="flex justify-start" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm">
                    Hi, yes
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:00</span>
                </div>
              </motion.div>
            )}

            {/* Milestone: Lead Replied */}
            {currentStep >= 3 && (
              <motion.div 
                className="flex justify-center py-2" 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="text-xs text-slate-400 font-medium">---Lead Replied---</div>
              </motion.div>
            )}

            {/* Message 4 - Jack */}
            {currentStep >= 4 && (
              <motion.div className="flex justify-start" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm">
                    I would like to check. I had 2 cars on finance 5 years ago
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:01</span>
                </div>
              </motion.div>
            )}

            {/* Milestone: Lead Qualified */}
            {currentStep >= 4 && (
              <motion.div 
                className="flex justify-center py-2" 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="text-xs text-slate-400 font-medium">---Lead Qualified---</div>
              </motion.div>
            )}

            {/* Message 5 - Sophie */}
            {currentStep >= 5 && (
              <motion.div className="flex justify-end" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    That's great Jack! Do you happen to have your vehicle finance agreement documents handy for those cars?
                  </div>
                  <span className="text-xs text-slate-400 pr-2">15:04</span>
                </div>
              </motion.div>
            )}

            {/* Typing indicator from Jack */}
            {currentStep === 5 && (
              <motion.div className="flex justify-start items-center gap-3" variants={messageVariants} initial="hidden" animate="visible">
                <div className="bg-slate-200 text-slate-500 rounded-full px-4 py-2 shadow-sm flex items-center justify-center gap-2">
                  <motion.span className="text-4xl font-black" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}>·</motion.span>
                  <motion.span className="text-4xl font-black" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>·</motion.span>
                  <motion.span className="text-4xl font-black" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}>·</motion.span>
                </div>
              </motion.div>
            )}

            {/* Dynamic messages after "Start" */}
            {/* Jack: No sorry */}
            {currentStep >= 6 && (
              <motion.div className="flex justify-start" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm">
                    No sorry
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:05</span>
                </div>
              </motion.div>
            )}

            {/* Jack: Not at Hand */}
            {currentStep >= 7 && (
              <motion.div className="flex justify-start" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm">
                    Not at Hand
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:05</span>
                </div>
              </motion.div>
            )}

            {/* Sophie DSAR */}
            {currentStep >= 8 && (
              <motion.div className="flex justify-end" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    No worries at all Jack. We can actually submit a Data Subject Access Request (DSAR) on your behalf to get those documents for you. Could you please complete this short DSAR form by clicking on this URL{' '}
                    <a href="https://www.dsarform.com/lead315" className="underline font-medium" style={{ color: "#FCC700" }}>
                      https://www.dsarform.com/lead315
                    </a>
                    ? It will help us move things forward with you
                  </div>
                  <span className="text-xs text-slate-400 pr-2">15:09</span>
                </div>
              </motion.div>
            )}

            {/* Jack's process question 1 */}
            {currentStep >= 9 && (
              <motion.div className="flex justify-start" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm">
                    What is the process from here?
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:20</span>
                </div>
              </motion.div>
            )}

            {/* Jack's process question 2 */}
            {currentStep >= 10 && (
              <motion.div className="flex justify-start" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm">
                    Do you let me know if I'm eligible to make a claim once you retrieve the docs and then I confirm I want to proceed?
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:20</span>
                </div>
              </motion.div>
            )}

            {/* Sophie final response */}
            {currentStep >= 11 && (
              <motion.div className="flex justify-end" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Absolutely, Jack. Once you've completed the DSAR form, we'll request your vehicle finance agreement and review it. If we find that you're eligible for a claim, we'll get in touch with you to discuss the next steps. It typically takes us about 30 working days to get everything sorted. Remember, we operate on a no-win no fee basis, so there's no risk to you. Just pop over to the URL and fill out the form when you can{' '}
                    <a href="https://www.dsarform.com/lead315" className="underline font-medium" style={{ color: "#FCC700" }}>
                      https://www.dsarform.com/lead315
                    </a>
                  </div>
                  <span className="text-xs text-slate-400 pr-2">15:22</span>
                </div>
              </motion.div>
            )}

            {/* Jack final thanks */}
            {currentStep >= 12 && (
              <motion.div className="flex justify-start" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm">
                    Thanks.
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:24</span>
                </div>
              </motion.div>
            )}

            {/* Milestone: DSAR Completed */}
            {currentStep >= 12 && (
              <motion.div 
                className="flex justify-center py-2" 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 3 }}
              >
                <div className="text-xs text-slate-400 font-medium">---DSAR Completed---</div>
              </motion.div>
            )}

            {/* Sophie message after claim filled */}
            {currentStep >= 13 && (
              <motion.div className="flex justify-end" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Jack, thanks for filling your claim, you will hear from us soon. Any further questions, feel free to ask
                  </div>
                  <span className="text-xs text-slate-400 pr-2">15:39</span>
                </div>
              </motion.div>
            )}

            {/* Jack final response */}
            {currentStep >= 14 && (
              <motion.div className="flex justify-start" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm">
                    No, that is all from me
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:40</span>
                </div>
              </motion.div>
            )}

            {/* Milestone: Sent To Client */}
            {currentStep >= 14 && (
              <motion.div 
                className="flex justify-center py-2" 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="text-xs text-slate-400 font-medium">---Sent To Client---</div>
              </motion.div>
            )}

            {/* Sophie closing message */}
            {currentStep >= 15 && (
              <motion.div className="flex justify-end" variants={messageVariants} initial="hidden" animate="visible">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Ok Jack, we hope you have a great day :)
                  </div>
                  <span className="text-xs text-slate-400 pr-2">15:41</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Start Button - Appears when typing indicator is showing */}
        {currentStep === 5 && !isAnimating && (
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startAnimation}
              className="px-8 py-3 rounded-xl font-semibold text-white shadow-lg text-base"
              style={{ backgroundColor: "#2563EB" }}
            >
              Start
            </motion.button>
          </div>
        )}

        {/* New Messages Indicator - Single centered icon button */}
        {showNewMessageIndicator && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
            <motion.button 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform"
              style={{ backgroundColor: "#2563EB" }}
              onClick={scrollToBottomManually}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
