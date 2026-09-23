import type { AILogEvent } from "@/types/ai";

export type AILogSubscriber = (event: AILogEvent) => void;

class AILogger {
  private events: AILogEvent[] = [];
  private subscribers: Set<AILogSubscriber> = new Set();

  public log(event: AILogEvent): void {
    this.events.push(event);

    // Notify registered subscribers (e.g. database sink, telemetry, tests)
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (err) {
        console.error("AI Logger subscriber error:", err);
      }
    }
  }

  public subscribe(subscriber: AILogSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  public getEvents(): readonly AILogEvent[] {
    return this.events;
  }

  public clearEvents(): void {
    this.events = [];
  }
}

export const aiLogger = new AILogger();
