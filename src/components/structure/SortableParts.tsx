"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { copy } from "@/lib/copy";
import type { Part } from "@/lib/db/schema";

const MOTION = { duration: 200, easing: "ease" };

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

interface SortablePartsProps {
  /** One group (front / chapters / back) — parts never leave their group. */
  items: Part[];
  /** While a name is being edited nothing moves. */
  disabled: boolean;
  label: (part: Part) => string;
  onMove: (part: Part, target: Part) => void;
  renderItem: (part: Part) => ReactNode;
}

/**
 * Drag to reorder: the others glide aside, the lifted row follows the mouse
 * and a thin line marks where it will land. A small move is still a click.
 */
export function SortableParts({ items, disabled, label, onMove, renderItem }: SortablePartsProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const find = (id: UniqueIdentifier | undefined) => items.find((part) => part.id === id);
  const name = (id: UniqueIdentifier) => {
    const part = find(id);
    return part ? label(part) : "";
  };
  const active = find(activeId ?? undefined);

  const announcements: Announcements = {
    onDragStart: ({ active }) => copy.structure.dragStart(name(active.id)),
    onDragOver: ({ active, over }) => (over ? copy.structure.dragOver(name(active.id), name(over.id)) : undefined),
    onDragEnd: ({ active, over }) =>
      over ? copy.structure.dragEnd(name(active.id)) : copy.structure.dragCancel(name(active.id)),
    onDragCancel: ({ active }) => copy.structure.dragCancel(name(active.id)),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: { draggable: copy.structure.dragInstructions } }}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active, over }) => {
        setActiveId(null);
        const part = find(active.id);
        const target = find(over?.id);
        if (part && target && part.id !== target.id) onMove(part, target);
      }}
    >
      <SortableContext items={items.map((part) => part.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ol className="space-y-0.5">
          {items.map((part) => (
            <SortableRow key={part.id} id={part.id} reducedMotion={reducedMotion}>
              {renderItem(part)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
      <DragOverlay dropAnimation={reducedMotion ? null : MOTION}>
        {active ? <div className="part-lifted">{label(active)}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableRow({
  id,
  reducedMotion,
  children,
}: {
  id: string;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id,
    transition: reducedMotion ? null : MOTION,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // The row stays in place as a thin line: where the lifted part will land.
      className={`part-row${isDragging ? " is-drop-target" : ""}`}
      {...listeners}
    >
      {children}
    </li>
  );
}
