import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, GripVertical, Zap } from 'lucide-react';
import { iconMap } from './NodesPanel';

export interface WorkflowNode {
  id: string;
  templateId: string;
  type: 'trigger' | 'ai' | 'logic' | 'integration' | 'data' | 'output';
  title: string;
  description: string;
  color: string;
  iconKey: string;
  config: Record<string, string | boolean | number>;
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
      className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${selected ? 'ring-2 ring-indigo-400' : ''}`}
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
      <div className="w-72 overflow-hidden rounded-lg border border-white/10 bg-black/70 shadow-xl backdrop-blur-md">
        <div className="node-drag-handle flex items-center border-b border-white/10 px-3 py-2" style={{ backgroundColor: `${node.color}22` }}>
          <GripVertical size={14} className="mr-2 text-gray-500" />
          <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: node.color }}>
            <Icon size={15} className="text-white" />
          </div>
          <div className="ml-2 min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{node.title}</p>
            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">{node.type}</p>
          </div>
          <span className="mr-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300">#{index + 1}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCollapsed(!collapsed);
            }}
            className="rounded-md p-1 text-gray-400 hover:bg-white/10"
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {!collapsed && (
          <div className="space-y-3 p-3">
            <p className="text-xs leading-relaxed text-gray-400">{node.description}</p>
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">Config</p>
              <div className="space-y-1">
                {Object.entries(node.config).slice(0, 3).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="shrink-0 text-gray-500">{key}</span>
                    <span className="min-w-0 truncate text-gray-300">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">Outputs</p>
              <div className="flex flex-wrap gap-1">
                {node.outputs.map((output) => (
                  <span key={output} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                    {output}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
