import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, GripVertical, KeyRound, Zap } from 'lucide-react';
import { iconMap } from './NodesPanel';

export interface WorkflowNode {
  id: string;
  templateId: string;
  type: 'trigger' | 'ai' | 'logic' | 'integration' | 'data' | 'output';
  title: string;
  description: string;
  appName: string;
  color: string;
  iconKey: string;
  config: Record<string, string | boolean | number>;
  credentials: string[];
  requiredInputs: string[];
  outputs: string[];
  position: { x: number; y: number };
}

interface FlowNodeProps {
  node: WorkflowNode;
  position: { x: number; y: number };
  index: number;
  onPositionChange: (id: string, newPosition: { x: number; y: number }) => void;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function FlowNode({ node, position, index, onPositionChange, selected, onSelect }: FlowNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState(false);
  const Icon = iconMap[node.iconKey as keyof typeof iconMap] ?? Zap;

  const handleMouseDown = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('.node-drag-handle')) {
      setIsDragging(true);
      setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y });
      onSelect(node.id);
      event.stopPropagation();
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    onPositionChange(node.id, {
      x: Math.max(20, event.clientX - dragStart.x),
      y: Math.max(20, event.clientY - dragStart.y),
    });
    event.preventDefault();
  };

  return (
    <motion.div
      className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${selected ? 'ring-2 ring-[#ff6d5a] ring-offset-2 ring-offset-[#f8fafc]' : ''}`}
      style={{ left: position.x, top: position.y, zIndex: selected ? 10 : 1 }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.16 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onClick={(event) => {
        onSelect(node.id);
        event.stopPropagation();
      }}
    >
      <div className="relative w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-[0_12px_32px_-26px_rgba(15,23,42,0.5)] backdrop-blur">
        <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300" />
        <span className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white bg-[#ff6d5a]" />
        <div className="node-drag-handle flex items-center px-3 py-2.5">
          <GripVertical size={13} className="mr-2 text-slate-300" />
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${node.color}18`, color: node.color }}>
            <Icon size={16} />
          </div>
          <div className="ml-2 min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{node.title}</p>
            <p className="truncate text-xs text-slate-400">{node.appName}</p>
          </div>
          <span className="mr-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{index + 1}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCollapsed(!collapsed);
            }}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {!collapsed && (
          <div className="border-t border-slate-100 px-3 pb-3 pt-2.5">
            <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{node.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{node.type}</span>
              {node.credentials.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <KeyRound size={11} />
                  {node.credentials.length}
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-slate-500">{node.requiredInputs.length} inputs</div>
              <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-slate-500">{node.outputs.length} outputs</div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
