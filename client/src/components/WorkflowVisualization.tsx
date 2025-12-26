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
    </div>
  );
}
