import type { Snapshot } from "../types";
export interface SnapshotRepository { insert(snapshot:Snapshot):Promise<boolean>; list(universeId:number):Promise<Snapshot[]>; }
export class MemorySnapshotRepository implements SnapshotRepository { private rows=new Map<string,Snapshot>(); async insert(s:Snapshot){const k=`${s.universeId}:${s.capturedAt}`;if(this.rows.has(k))return false;this.rows.set(k,s);return true;} async list(id:number){return [...this.rows.values()].filter(x=>x.universeId===id).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));} }
