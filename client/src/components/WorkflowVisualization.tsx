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
      0% { stroke: #d1d5db; filter: drop-shadow(0 0 0px rgba(0, 0, 0, 0)); }
      50% { stroke: #ffffff; filter: drop-shadow(0 0 15px rgba(255, 255, 255, 1)); }
      100% { stroke: #d1d5db; filter: drop-shadow(0 0 0px rgba(0, 0, 0, 0)); }
    }
    @keyframes lineFadeBack {
      0% { stroke: #ffffff; filter: drop-shadow(0 0 15px rgba(255, 255, 255, 1)); }
      100% { stroke: #d1d5db; filter: drop-shadow(0 0 0px rgba(0, 0, 0, 0)); }
    }
    .node-active-stroke {
      stroke-dasharray: 60, 180;
      animation: strokeRotate 2s linear infinite;
    }
    .line-quick-glow { animation: lineQuickGlow 0.4s ease-in-out forwards; }
    .line-fade-back { animation: lineFadeBack 0.8s ease-in-out forwards; }
    .card-gradient-overlay {
      position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
      background: linear-gradient(to top left, rgba(55, 65, 81, 0.07), transparent 70%);
      transition: background 0.5s ease;
    }
    .card-active-amber .card-gradient-overlay { background: linear-gradient(to top left, rgba(245, 158, 11, 0.12), transparent 70%); }
    .card-active-purple .card-gradient-overlay { background: linear-gradient(to top left, rgba(168, 85, 247, 0.12), transparent 70%); }
    .card-active-emerald .card-gradient-overlay { background: linear-gradient(to top left, rgba(16, 185, 129, 0.12), transparent 70%); }
    .card-active-cyan .card-gradient-overlay { background: linear-gradient(to top left, rgba(6, 182, 212, 0.12), transparent 70%); }
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
    
    const sequence = async () => {
      await new Promise(r => setTimeout(r, 3000));
      setVisitedNodes(prev => new Set(prev).add('engaging'));
      
      await new Promise(r => setTimeout(r, 1000));
      setIsGlowing1(true);
      await new Promise(r => setTimeout(r, 400));
      setIsGlowing1(false);
      setIsFadingBack1(true);
      setActiveNode('agent');
      setVisitedNodes(prev => new Set(prev).add('agent'));
      
      await new Promise(r => setTimeout(r, 1500));
      setAgentStatus('msg1');
      await new Promise(r => setTimeout(r, 2000));
      setAgentStatus('msg2');
      
      await new Promise(r => setTimeout(r, 2000));
      setIsGlowing2(true);
      await new Promise(r => setTimeout(r, 400));
      setIsGlowing2(false);
      setIsFadingBack2(true);
      setActiveNode('guardrails');
      setVisitedNodes(prev => new Set(prev).add('guardrails'));
      const checks = ['verifying...', 'No violations', 'On-topic sales', 'Clean language', 'No personal data', 'No Data Leakage'];
      for (const t of checks) {
        setGuardrailsStatus(t);
        await new Promise(r => setTimeout(r, 1000));
      }
      
      setGuardrailsStatus('Message Sent');
      setIsApproved(true);
      await new Promise(r => setTimeout(r, 10000));
      
      // Reset
      setActiveNode('contact');
      setVisitedNodes(new Set(['contact']));
      setIsFadingBack1(false);
      setIsFadingBack2(false);
      setAgentStatus('thinking');
      setGuardrailsStatus('');
      setIsApproved(false);
      sequence();
    };
    sequence();
  }, [isInView]);

  const getStatusColor = (node: string, activeClass: string, visitedClass: string, defaultClass: string) => {
    if (activeNode === node) return activeClass;
    return visitedNodes.has(node) ? visitedClass : defaultClass;
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center font-sans text-gray-900 md:overflow-hidden relative">
      <NodeStrokeAnimation />
      
      <div className="relative w-full md:h-[400px] bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300/50 rounded-3xl overflow-hidden shadow-lg flex flex-col md:flex-row items-center justify-center px-12 py-12 md:py-0 space-y-24 md:space-y-0 gap-8 md:gap-24">
        {/* SVG Container for Connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <line x1="25%" y1="50%" x2="50%" y2="50%" stroke="#d1d5db" strokeWidth="2" className={`${isGlowing1 ? 'line-quick-glow' : ''} ${isFadingBack1 ? 'line-fade-back' : ''}`} />
          <line x1="50%" y1="50%" x2="75%" y2="50%" stroke="#d1d5db" strokeWidth="2" className={`${isGlowing2 ? 'line-quick-glow' : ''} ${isFadingBack2 ? 'line-fade-back' : ''}`} />
          
          {/* Animated Connectors/Circles */}
          <circle cx="25%" cy="50%" r="4" fill="#d1d5db" />
          <circle cx="50%" cy="50%" r="4" fill="#d1d5db" />
          <circle cx="75%" cy="50%" r="4" fill="#d1d5db" />
        </svg>

        {/* Lead Card */}
        <div className="relative z-10">
          <div className={`absolute -inset-1 rounded-xl transition-all duration-500 ${activeNode === 'contact' ? 'border-2 border-amber-500/50 node-active-stroke' : ''}`} />
          <div className={`absolute inset-0 rounded-xl blur-3xl transition-opacity duration-500 ${activeNode === 'contact' ? 'bg-amber-400/40 opacity-100' : 'opacity-0'}`} />
          <div className={`relative bg-white border-2 rounded-xl p-6 w-64 transition-all duration-300 ${getStatusColor('contact', 'border-amber-500 shadow-xl card-active-amber', 'border-gray-200 shadow-md', 'border-gray-200')}`}>
            <div className="card-gradient-overlay" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-100"><User className="w-5 h-5 text-amber-600" /></div>
              <div><h3 className="font-bold text-sm text-gray-900">Lead #315</h3><p className="text-[10px] text-gray-400 uppercase font-semibold">Jack Johnson</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-300 text-[10px]">
              <span className="text-amber-600 font-mono">Status: </span>
              <span className="text-gray-700 font-mono">{isApproved ? 'Lead Engaged' : 'Active'}</span>
            </div>
          </div>
        </div>

        {/* Agent Card */}
        <div className="relative z-10">
          <div className={`absolute -inset-1 rounded-xl transition-all duration-500 ${activeNode === 'agent' ? 'border-2 border-purple-500/50 node-active-stroke' : ''}`} />
          <div className={`absolute inset-0 rounded-xl blur-3xl transition-opacity duration-500 ${activeNode === 'agent' ? 'bg-purple-400/40 opacity-100' : 'opacity-0'}`} />
          <div className={`relative bg-white border-2 rounded-xl p-6 w-64 transition-all duration-300 ${getStatusColor('agent', 'border-purple-500 shadow-xl card-active-purple', 'border-gray-200 shadow-md', 'border-gray-200')}`}>
            <div className="card-gradient-overlay" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-100"><Bot className="w-5 h-5 text-purple-600" /></div>
              <div><h3 className="font-bold text-sm text-gray-900">AI Agent</h3><p className="text-[10px] text-gray-400 uppercase font-semibold">GPT-5.2</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-300 text-[10px] h-[34px] flex items-center">
              <span className="text-purple-600 font-mono">Output: </span>
              <span className="ml-2 truncate text-gray-700 font-mono">{agentStatus === 'thinking' ? '...' : (agentStatus === 'msg1' ? 'Good morning :)' : 'Is this Jack?')}</span>
            </div>
          </div>
        </div>

        {/* Guardrails Card */}
        <div className="relative z-10">
          <div className={`absolute -inset-1 rounded-xl transition-all duration-500 ${activeNode === 'guardrails' ? (isApproved ? 'border-emerald-500/50' : 'border-cyan-500/50') + ' node-active-stroke' : ''}`} />
          <div className={`absolute inset-0 rounded-xl blur-3xl transition-opacity duration-500 ${isApproved ? 'bg-emerald-400/40' : activeNode === 'guardrails' ? 'bg-cyan-400/40 opacity-100' : 'opacity-0'}`} />
          <div className={`relative bg-white border-2 rounded-xl p-6 w-64 transition-all duration-300 ${isApproved ? 'border-emerald-500 shadow-xl card-active-emerald' : getStatusColor('guardrails', 'border-cyan-500 shadow-xl card-active-cyan', 'border-gray-200 shadow-md', 'border-gray-200')}`}>
            <div className="card-gradient-overlay" />
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-100' : 'bg-cyan-100'}`}>
                {isApproved ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Shield className="w-5 h-5 text-cyan-600" />}
              </div>
              <div><h3 className="font-bold text-sm text-gray-900">Guardrails</h3><p className="text-[10px] text-gray-400 uppercase font-semibold">Security</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-300 text-[10px] h-[34px] flex items-center">
              <span className="text-cyan-600 font-mono">Status: </span>
              <span className="ml-2 truncate text-gray-700 font-mono">{guardrailsStatus}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-12 max-w-2xl text-center">
        <p className="text-gray-600 text-sm leading-relaxed">
          Every AI reply passes through <span className={`font-bold ${isApproved ? 'text-emerald-600' : 'text-cyan-600'}`}>Security Guardrails</span>, so no message leaves the system without safety and compliance checks—keeping responses reliable and on‑brand.
        </p>
      </div>
    </div>
  );
}
