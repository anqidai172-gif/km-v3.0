export interface GraphNode {
  id: string;
  label: string;
  categoryColor: string;
  mass: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  strength: number;
}

export interface GraphViewState {
  offsetX: number;
  offsetY: number;
  scale: number;
}
