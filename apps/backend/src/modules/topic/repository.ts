/**
 * Topic repository — curated demo topics, loaded from JSON seed files up front
 * (Architecture Document §6.1, an M0 deliverable).
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { topicSchema, type Topic } from "../../contracts/topic.js";

const SEED_DIR = new URL("../../data/topics/", import.meta.url);

export class TopicRepository {
  private topics = new Map<string, Topic>();

  constructor() {
    this.loadSeed();
  }

  private loadSeed(): void {
    let files: string[];
    try {
      files = readdirSync(SEED_DIR);
    } catch {
      return; // no seed dir yet
    }
    for (const name of files.filter((f) => f.endsWith(".json")).sort()) {
      const raw = readFileSync(fileURLToPath(new URL(name, SEED_DIR)), "utf-8");
      const topic = topicSchema.parse(JSON.parse(raw));
      this.topics.set(topic.topicId, topic);
    }
  }

  list(): Topic[] {
    return [...this.topics.values()];
  }

  get(topicId: string): Topic | undefined {
    return this.topics.get(topicId);
  }
}

/** Singleton repository for the skeleton. */
export const topics = new TopicRepository();
