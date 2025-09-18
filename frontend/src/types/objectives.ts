export interface ObjectiveRelationTarget {
  id: string;
  text: string;
  status?: string;
  priority?: string | null;
}

export interface ObjectiveRelatedItem {
  id: string; // relationship id
  type?: string;
  rationale?: string | null;
  weight?: number | null;
  target: ObjectiveRelationTarget;
}

export interface ObjectiveWithRelated {
  id: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  related: ObjectiveRelatedItem[];
  tags?: string[];
}

export type TicketStatus = 'pending' | 'accepted' | 'discarded';

export interface Ticket extends ObjectiveWithRelated {
  status: TicketStatus;
  originalText: string;
  tags: string[];
}
