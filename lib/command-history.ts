import type { Shape, Point } from "./canvas-types";

export interface Command {
  type: string;
  description: string;
  timestamp: number;
}

export interface AddShapeCommand extends Command {
  type: "addShape";
  shape: Shape;
}

export interface DeleteShapesCommand extends Command {
  type: "deleteShapes";
  shapes: Shape[];
  previousShapes: Shape[];
}

export interface MoveShapeCommand extends Command {
  type: "moveShape";
  shapeId: string;
  from: Point[];
  to: Point[];
}

export interface ModifyShapeCommand extends Command {
  type: "modifyShape";
  shapeId: string;
  from: Shape;
  to: Shape;
}

export type HistoryCommand = AddShapeCommand | DeleteShapesCommand | MoveShapeCommand | ModifyShapeCommand;

export class CommandHistory {
  private commands: HistoryCommand[] = [];
  private currentIndex: number = -1;

  // Command factory functions
  createAddShapeCommand(shape: Shape): AddShapeCommand {
    return {
      type: "addShape",
      shape: { ...shape },
      description: `Agregar ${shape.type}`,
      timestamp: Date.now(),
    };
  }

  createDeleteShapesCommand(shapes: Shape[], allShapes: Shape[]): DeleteShapesCommand {
    return {
      type: "deleteShapes",
      shapes: shapes.map((s) => ({ ...s })),
      previousShapes: allShapes.map((s) => ({ ...s })),
      description: `Eliminar ${shapes.length} forma${shapes.length > 1 ? "s" : ""}`,
      timestamp: Date.now(),
    };
  }

  createMoveShapeCommand(
    shapeId: string,
    from: Point[],
    to: Point[],
    shapeType: string
  ): MoveShapeCommand {
    return {
      type: "moveShape",
      shapeId,
      from: from.map((p) => ({ ...p })),
      to: to.map((p) => ({ ...p })),
      description: `Mover ${shapeType}`,
      timestamp: Date.now(),
    };
  }

  createModifyShapeCommand(
    shapeId: string,
    from: Shape,
    to: Shape
  ): ModifyShapeCommand {
    return {
      type: "modifyShape",
      shapeId,
      from: { ...from },
      to: { ...to },
      description: `Modificar ${to.type}`,
      timestamp: Date.now(),
    };
  }

  // History management
  executeCommand(command: HistoryCommand): void {
    const newCommands = this.commands.slice(0, this.currentIndex + 1);
    newCommands.push(command);
    this.commands = newCommands;
    this.currentIndex = this.commands.length - 1;
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.commands.length - 1;
  }

  undo(): HistoryCommand | null {
    if (!this.canUndo()) return null;
    return this.commands[this.currentIndex--];
  }

  redo(): HistoryCommand | null {
    if (!this.canRedo()) return null;
    return this.commands[++this.currentIndex];
  }

  clear(): void {
    this.commands = [];
    this.currentIndex = -1;
  }

  getHistory(): HistoryCommand[] {
    return [...this.commands];
  }
}