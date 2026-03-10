import { useState, useCallback, ReactNode } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export interface DashboardWidget {
  id: string;
  label: string;
  component: ReactNode;
  visible: boolean;
}

const STORAGE_KEY = "t2-dashboard-order";
const VISIBILITY_KEY = "t2-dashboard-visibility";

function getStoredOrder(): string[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function getStoredVisibility(): Record<string, boolean> | null {
  try {
    const stored = localStorage.getItem(VISIBILITY_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function useDashboardWidgets(defaultWidgets: DashboardWidget[]) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    const storedOrder = getStoredOrder();
    const storedVisibility = getStoredVisibility();

    let ordered = defaultWidgets;
    if (storedOrder) {
      const widgetMap = new Map(defaultWidgets.map((w) => [w.id, w]));
      const reordered: DashboardWidget[] = [];
      for (const id of storedOrder) {
        const w = widgetMap.get(id);
        if (w) {
          reordered.push(w);
          widgetMap.delete(id);
        }
      }
      // Add any new widgets not in stored order
      widgetMap.forEach((w) => reordered.push(w));
      ordered = reordered;
    }

    if (storedVisibility) {
      ordered = ordered.map((w) => ({
        ...w,
        visible: storedVisibility[w.id] ?? w.visible,
      }));
    }

    return ordered;
  });

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    setWidgets((prev) => {
      const items = Array.from(prev);
      const [removed] = items.splice(result.source.index, 1);
      items.splice(result.destination!.index, 0, removed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((w) => w.id)));
      return items;
    });
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    setWidgets((prev) => {
      const updated = prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
      const vis: Record<string, boolean> = {};
      updated.forEach((w) => (vis[w.id] = w.visible));
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(vis));
      return updated;
    });
  }, []);

  const resetLayout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VISIBILITY_KEY);
    setWidgets(defaultWidgets);
  }, [defaultWidgets]);

  return { widgets, onDragEnd, toggleVisibility, resetLayout };
}

export function DashboardWidgetManager({
  widgets,
  toggleVisibility,
  resetLayout,
}: {
  widgets: DashboardWidget[];
  toggleVisibility: (id: string) => void;
  resetLayout: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" />
          Widgets
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-xs">Mostrar/Ocultar Widgets</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {widgets.map((w) => (
          <DropdownMenuCheckboxItem
            key={w.id}
            checked={w.visible}
            onCheckedChange={() => toggleVisibility(w.id)}
            className="text-xs"
          >
            {w.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <div className="p-1">
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5" onClick={resetLayout}>
            <RotateCcw className="h-3 w-3" />
            Restaurar padrão
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DraggableDashboard({
  widgets,
  onDragEnd,
}: {
  widgets: DashboardWidget[];
  onDragEnd: (result: DropResult) => void;
}) {
  const visibleWidgets = widgets.filter((w) => w.visible);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="dashboard">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
            {visibleWidgets.map((widget, index) => (
              <Draggable key={widget.id} draggableId={widget.id} index={widgets.indexOf(widget)}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`relative group transition-shadow ${
                      snapshot.isDragging ? "z-50 shadow-2xl shadow-primary/20 rounded-xl" : ""
                    }`}
                  >
                    <div
                      {...provided.dragHandleProps}
                      className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary/90 rounded-md p-1 cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {widget.component}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
