import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { User, Bot, CheckCircle2, Shield } from 'lucide-react';

const NodeStrokeAnimation = () => (
  <style>{`
    @keyframes strokeRotate {
      0% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: -240; }
    }
    @keyframes connectorFlow {
      0% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: 10; }
    }
    @keyframes lineQuickGlow {
      0% {
        stroke: #3f3f46;
        filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0));
      }
      50% {
        stroke: #d4d4d8;
        filter: drop-shadow(0 0 12px rgba(212, 212, 216, 0.9));
      }
      100% {
        stroke: #3f3f46;
        filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0));
      }
    }
    @keyframes lineFadeBack {
      0% {
        stroke: #d4d4d8;
        filter: drop-shadow(0 0 12px rgba(212, 212, 216, 0.9));
      }
      100% {
        stroke: #71717a;
        filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0));
      }
    }
    .node-active-stroke {
      stroke-dasharray: 60, 180;
      animation: strokeRotate 2s linear infinite;
    }
    .line-quick-glow {
      animation: lineQuickGlow 0.4s ease-in-out forwards;
    }
    .line-fade-back {
      animation: lineFadeBack 0.8s ease-in-out forwards;
    }
    .line-visited {
      stroke: #71717a;
    }
  `}</style>
);

export default function WorkflowVisualization() {
  const [activeNode, setActiveNode] = useState<'contact' | 'agent' | 'guardrails' | null>('contact');
  const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set(['contact']));
  const [isGlowing1, setIsGlowing1] = useState(false);
  const [isFadingBack1, setIsFadingBack1] = useState(false);
  const [isGlowing2, setIsGlowing2] = useState(false);
  const [isFadingBack2, setIsFadingBack2] = useState(false);
  const [agentStatus, setAgentStatus] = useState<'thinking' | 'msg1' | 'msg2'>('thinking');
  const [guardrailsStatus, setGuardrailsStatus] = useState<string>('');
  const [isApproved, setIsApproved] = useState(false);

  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { amount: 0.5, once: true });

  useEffect(() => {
    if (!isInView) return;

    setAgentStatus('thinking');
    
    const sequence = async () => {
      // Step 1: Contact Engagement
      await new Promise(r => setTimeout(r, 3000));
      setVisitedNodes(prev => new Set(prev).add('engaging'));
      
      // Transition to Agent
      await new Promise(r => setTimeout(r, 1000));
      setIsGlowing1(true);
      await new Promise(r => setTimeout(r, 400));
      setIsGlowing1(false);
      setIsFadingBack1(true);
      setActiveNode('agent');
      setVisitedNodes(prev => new Set(prev).add('agent'));
      
      // Agent Thinking
      await new Promise(r => setTimeout(r, 1500));
      setAgentStatus('msg1');
      await new Promise(r => setTimeout(r, 2000));
      setAgentStatus('msg2');
      
      // Transition to Guardrails
      await new Promise(r => setTimeout(r, 2000));
      setIsGlowing2(true);
      await new Promise(r => setTimeout(r, 400));
      setIsGlowing2(false);
      setIsFadingBack2(true);
      setActiveNode('guardrails');
      setVisitedNodes(prev => new Set(prev).add('guardrails'));
      const transgressions = [
        'verifying...', 'No violations', 'On-topic sales', 'Clean content', 
        'Clean language', 'No personal data', 'No credentials', 
        'No unauthorized links', 'No Data Leakage'
      ];
      for (const t of transgressions) {
        setGuardrailsStatus(t);
        await new Promise(r => setTimeout(r, 1000));
      }
      
      setGuardrailsStatus('...');
      await new Promise(r => setTimeout(r, 1500));
      setGuardrailsStatus('Message Sent');
      setIsApproved(true);
      
      // Restart loop
      await new Promise(r => setTimeout(r, 10000));
      setActiveNode('contact');
      setVisitedNodes(new Set(['contact']));
      setIsGlowing1(false);
      setIsFadingBack1(false);
      setIsGlowing2(false);
      setIsFadingBack2(false);
      setAgentStatus('thinking');
      setGuardrailsStatus('');
      setIsApproved(false);
      
      await new Promise(r => setTimeout(r, 50));
      sequence();
    };
    sequence();
  }, [isInView]);

  const getStatusColor = (node: string, activeClass: string, visitedClass: string, defaultClass: string) => {
    if (activeNode === node) return activeClass;
    if (visitedNodes.has(node)) return visitedClass;
    return defaultClass;
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center p-8 font-sans text-slate-100 relative">
      <NodeStrokeAnimation />
      
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">AI Agent Workflow</h2>
        <p className="text-slate-400">Automated compliance and interaction pipeline</p>
      </div>

      <div className="relative w-full max-w-5xl md:h-[300px] bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between px-12 py-12 md:py-0 space-y-24 md:space-y-0">
        
        {/* SVG Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <g className="hidden md:block">
            <line x1="25%" y1="50%" x2="50%" y2="50%" stroke="#3f3f46" strokeWidth="2" 
              className={`${isGlowing1 ? 'line-quick-glow' : ''} ${isFadingBack1 ? 'line-fade-back' : ''} ${visitedNodes.has('agent') ? 'line-visited' : ''}`}
            />
            <line x1="50%" y1="50%" x2="75%" y2="50%" stroke="#3f3f46" strokeWidth="2"
              className={`${isGlowing2 ? 'line-quick-glow' : ''} ${isFadingBack2 ? 'line-fade-back' : ''} ${visitedNodes.has('guardrails') ? 'line-visited' : ''}`}
            />
          </g>
        </svg>

        {/* Lead Node */}
        <div className="relative z-10">
          <div className="relative">
            {activeNode === 'contact' && (
              <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none" viewBox="0 0 200 160" preserveAspectRatio="none">
                <rect x="4" y="4" width="100%" height="100%" rx="12" fill="none" stroke="#eab308" strokeWidth="2" className="node-active-stroke" style={{ width: 'calc(100% - 8px)', height: 'calc(100% - 8px)' }} />
              </svg>
            )}
            <div className={`relative bg-slate-900 border-2 rounded-xl p-6 w-64 transition-all duration-300 ${getStatusColor('contact', 'border-amber-500 shadow-[0_0_20px_-5px_rgba(234,179,8,0.3)]', 'border-amber-500/30 shadow-none', 'border-slate-700 shadow-none')}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${getStatusColor('contact', 'bg-amber-500/20', 'bg-amber-500/10', 'bg-slate-800')}`}>
                  <User className={`w-5 h-5 ${getStatusColor('contact', 'text-amber-400', 'text-amber-400/50', 'text-slate-500')}`} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Lead #315</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Jack Johnson</p>
                </div>
              </div>
              <div className="bg-slate-950/50 rounded-lg p-2 border border-slate-800">
                <div className="flex justify-between items-center text-[10px]">
                  <span className={`font-mono ${getStatusColor('contact', 'text-amber-400', 'text-amber-400/50', 'text-slate-500')}`}>status</span>
                  <span className="text-slate-300 font-mono">
                    {guardrailsStatus === 'Message Sent' ? 'Lead Engaged' : visitedNodes.has('engaging') ? 'Engaging' : 'Not Engaged'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Agent Node */}
        <div className="relative z-10">
          <div className="relative">
            {activeNode === 'agent' && (
              <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none" viewBox="0 0 200 160" preserveAspectRatio="none">
                <rect x="4" y="4" width="100%" height="100%" rx="12" fill="none" stroke="#8b5cf6" strokeWidth="2" className="node-active-stroke" style={{ width: 'calc(100% - 8px)', height: 'calc(100% - 8px)' }} />
              </svg>
            )}
            <div className={`relative bg-slate-900 border-2 rounded-xl p-6 w-64 transition-all duration-300 ${getStatusColor('agent', 'border-purple-500 shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)]', 'border-purple-500/30 shadow-none', 'border-slate-700 shadow-none')}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${getStatusColor('agent', 'bg-purple-500/20', 'bg-purple-500/10', 'bg-slate-800')}`}>
                  <Bot className={`w-5 h-5 ${getStatusColor('agent', 'text-purple-400', 'text-purple-400/50', 'text-slate-500')}`} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">AI Agent</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">GPT-5.2</p>
                </div>
              </div>
              <div className="bg-slate-950/50 rounded-lg p-2 border border-slate-800 h-[34px] flex items-center overflow-hidden">
                <div className="flex justify-between items-center text-[10px] w-full">
                  <span className={`font-mono ${getStatusColor('agent', 'text-purple-400', 'text-purple-400/50', 'text-slate-500')}`}>Output</span>
                  <span className="text-slate-300 font-mono text-right flex-1 truncate ml-2">
                    {visitedNodes.has('agent') && (
                      agentStatus === 'thinking' ? '...' : (
                        <motion.div key={agentStatus} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                          {agentStatus === 'msg1' ? 'Good morning :)' : 'Is this Jack?'}
                        </motion.div>
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Guardrails Node */}
        <div className="relative z-10">
          <div className="relative">
            {activeNode === 'guardrails' && (
              <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none" viewBox="0 0 200 160" preserveAspectRatio="none">
                <rect x="4" y="4" width="100%" height="100%" rx="12" fill="none" stroke={isApproved ? "#00D130" : "#06b6d4"} strokeWidth="2" className="node-active-stroke" style={{ width: 'calc(100% - 8px)', height: 'calc(100% - 8px)' }} />
              </svg>
            )}
            <div className={`relative bg-slate-900 border-2 rounded-xl p-6 w-64 ${isApproved ? 'border-[#00D130]' : getStatusColor('guardrails', 'border-cyan-500 shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)]', 'border-cyan-500/30 shadow-none', 'border-slate-700 shadow-none')}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${isApproved ? 'bg-[#00D130]/20' : getStatusColor('guardrails', 'bg-cyan-500/20', 'bg-cyan-500/10', 'bg-slate-800')}`}>
                  {isApproved ? <CheckCircle2 className="w-5 h-5 text-[#00D130]" /> : <Shield className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Guardrails</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">SECURITY</p>
                </div>
              </div>
              <div className="bg-slate-950/50 rounded-lg p-2 border border-slate-800 h-[34px] flex items-center">
                <div className="flex justify-between items-center text-[10px] w-full">
                  <span className={`font-mono ${isApproved ? 'text-[#00D130]' : 'text-slate-500'}`}>status</span>
                  <span className="text-slate-300 font-mono text-right flex-1 truncate ml-2">{guardrailsStatus}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
