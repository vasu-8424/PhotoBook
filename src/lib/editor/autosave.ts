import type { BookDesign } from "@/types/design";
import { AUTOSAVE_DEBOUNCE_MS } from "./constants";
import type { SaveStatus } from "./types";

export type SaveDesignFn = (design: BookDesign) => Promise<boolean>;
export type StatusChangeCallback = (status: SaveStatus, error?: string) => void;

export class AutosaveController {
  private timer: NodeJS.Timeout | null = null;
  private pendingDesign: BookDesign | null = null;
  private isSaving: boolean = false;
  private debounceMs: number;
  private saveFn: SaveDesignFn;
  private onStatusChange?: StatusChangeCallback;

  constructor(
    saveFn: SaveDesignFn,
    debounceMs: number = AUTOSAVE_DEBOUNCE_MS,
    onStatusChange?: StatusChangeCallback,
  ) {
    this.saveFn = saveFn;
    this.debounceMs = debounceMs;
    this.onStatusChange = onStatusChange;
  }

  public scheduleSave(design: BookDesign): void {
    this.pendingDesign = design;
    this.notifyStatus("UNSAVED");

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.executeSave();
    }, this.debounceMs);
  }

  public async flush(): Promise<boolean> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return this.executeSave();
  }

  private async executeSave(): Promise<boolean> {
    if (!this.pendingDesign || this.isSaving) {
      return false;
    }

    const designToSave = this.pendingDesign;
    this.pendingDesign = null;
    this.isSaving = true;
    this.notifyStatus("SAVING");

    try {
      const success = await this.saveFn(designToSave);
      this.isSaving = false;

      if (success) {
        // If another mutation occurred while saving, schedule another save
        if (this.pendingDesign) {
          this.scheduleSave(this.pendingDesign);
        } else {
          this.notifyStatus("SAVED");
        }
        return true;
      } else {
        this.pendingDesign = designToSave; // Retain state for retry
        this.notifyStatus("ERROR", "Failed to save design to server.");
        return false;
      }
    } catch (err) {
      this.isSaving = false;
      this.pendingDesign = designToSave; // Retain state for retry
      const errMsg = err instanceof Error ? err.message : "Network error during autosave.";
      this.notifyStatus("ERROR", errMsg);
      return false;
    }
  }

  public cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingDesign = null;
  }

  private notifyStatus(status: SaveStatus, error?: string): void {
    if (this.onStatusChange) {
      this.onStatusChange(status, error);
    }
  }
}
