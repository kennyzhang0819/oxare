// Content schema. Everything the game knows about is one of these records.
// Ids are stable slugs; the graph compiles them to dense integers.

export type ItemId = string;
export type RecipeId = string;
export type StationId = string;
export type TechId = string;
export type GatherNodeId = string;
export type EnemyId = string;
export type SkillId = string;

export type Qty = Record<ItemId, number>;

export interface Item {
  id: ItemId;
  name: string;
  category: string;
  tier: number;
  icon?: string;
  description?: string;
  equip?: { slot: "weapon" | "armor" | "tool"; attack?: number; defense?: number; hp?: number; toolTier?: number };
}

export interface Recipe {
  id: RecipeId;
  name?: string;
  inputs: Qty;
  outputs: Qty;
  station: StationId;
  time: number;
  unlock?: TechId;
  tags?: string[];
}

export interface Station {
  id: StationId;
  name: string;
  tier: number;
  unlock?: TechId;
  icon?: string;
}

export interface Tech {
  id: TechId;
  name: string;
  tier: number;
  cost: Qty;
  requires?: TechId[];
  description?: string;
}

export interface Drop {
  item: ItemId;
  min: number;
  max: number;
  chance: number;
}

export interface GatherNode {
  id: GatherNodeId;
  name: string;
  skill: SkillId;
  time: number;
  drops: Drop[];
  toolTier?: number;
  unlock?: TechId;
  icon?: string;
}

export interface Enemy {
  id: EnemyId;
  name: string;
  region: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  drops: Drop[];
  boss?: boolean;
  unlock?: TechId;
  icon?: string;
}

export interface Skill {
  id: SkillId;
  name: string;
  icon?: string;
}

export interface Content {
  items: Item[];
  recipes: Recipe[];
  stations: Station[];
  techs: Tech[];
  gatherNodes: GatherNode[];
  enemies: Enemy[];
  skills: Skill[];
  startTechs?: TechId[];
  goals?: ItemId[];
}

export const RECYCLE_TAG = "recycle";

export function emptyContent(): Content {
  return { items: [], recipes: [], stations: [], techs: [], gatherNodes: [], enemies: [], skills: [], startTechs: [], goals: [] };
}
