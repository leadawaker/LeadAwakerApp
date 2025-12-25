import { useRef, useState } from "react";
import { Zap, Lock, ArrowRight } from "lucide-react";

export default function Canvas() {
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [positions, setPositions] = useState({
    agent: { x: 100, y: 150 },
    guardrails: { x: 500, y: 150 },
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(nodeId);
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !startPos.current || !canvasRef.current) return;

    const deltaX = e.clientX - startPos.current.x;
    const deltaY = e.clientY - startPos.current.y;

    setPositions((prev) => ({
      ...prev,
      [isDragging]: {
        x: Math.max(0, Math.min(canvasRef.current!.clientWidth - 200, prev[isDragging as keyof typeof prev].x + deltaX)),
        y: Math.max(0, Math.min(canvasRef.current!.clientHeight - 160, prev[isDragging as keyof typeof prev].y + deltaY)),
      },
    }));

    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(null);
    startPos.current = null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 pt-20 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">AI Agent Canvas</h1>
          <p className="text-slate-400">Drag nodes to arrange your workflow</p>
        </div>

        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative w-full h-[600px] bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden cursor-move"
        >
          {/* Connection Line */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0 }}
          >
            <line
              x1={positions.agent.x + 100}
              y1={positions.agent.y + 60}
              x2={positions.guardrails.x + 100}
              y2={positions.guardrails.y + 60}
              stroke="url(#gradient)"
              strokeWidth="2"
              strokeDasharray="5,5"
              markerEnd="url(#arrowhead)"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#06b6d4" />
              </marker>
            </defs>
          </svg>

          {/* AI Agent Node */}
          <div
            onMouseDown={(e) => handleMouseDown("agent", e)}
            style={{
              transform: `translate(${positions.agent.x}px, ${positions.agent.y}px)`,
              cursor: isDragging === "agent" ? "grabbing" : "grab",
            }}
            className="absolute w-48 transition-transform duration-75 z-10"
            data-testid="node-ai-agent"
          >
            <div className="group">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300" />

              {/* Node body */}
              <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 border border-purple-500/50 rounded-xl p-4 shadow-2xl hover:border-purple-400/80 transition-all duration-300">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Zap className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">AI Agent</h3>
                    <p className="text-xs text-slate-400">Processing node</p>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-2 mb-4">
                  <div className="bg-slate-900/50 rounded p-2 border border-slate-600/30">
                    <p className="text-xs text-slate-300">
                      <span className="text-purple-400 font-mono">model</span>
                      <span className="text-slate-500">: gpt-4</span>
                    </p>
                  </div>
                </div>

                {/* Connection point indicator */}
                <div className="flex justify-end">
                  <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Security Guardrails Node */}
          <div
            onMouseDown={(e) => handleMouseDown("guardrails", e)}
            style={{
              transform: `translate(${positions.guardrails.x}px, ${positions.guardrails.y}px)`,
              cursor: isDragging === "guardrails" ? "grabbing" : "grab",
            }}
            className="absolute w-48 transition-transform duration-75 z-10"
            data-testid="node-security-guardrails"
          >
            <div className="group">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300" />

              {/* Node body */}
              <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 border border-cyan-500/50 rounded-xl p-4 shadow-2xl hover:border-cyan-400/80 transition-all duration-300">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <Lock className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Security Guardrails</h3>
                    <p className="text-xs text-slate-400">Validation layer</p>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-2 mb-4">
                  <div className="bg-slate-900/50 rounded p-2 border border-slate-600/30">
                    <p className="text-xs text-slate-300">
                      <span className="text-cyan-400 font-mono">rules</span>
                      <span className="text-slate-500">: active</span>
                    </p>
                  </div>
                </div>

                {/* Connection point indicator */}
                <div className="flex justify-start">
                  <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info footer */}
        <div className="mt-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur">
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <ArrowRight className="w-4 h-4 text-slate-500" />
            <p>
              The <span className="text-purple-400 font-medium">AI Agent</span> processes input and sends output to the <span className="text-cyan-400 font-medium">Security Guardrails</span> for validation before final output.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
