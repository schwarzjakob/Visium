export interface ObjectiveRelatedItem {
  id: string;
  text: string;
}

export interface ObjectiveWithRelated {
  id: string;
  text: string;
  createdAt: string;
  related: ObjectiveRelatedItem[];
}

export type TicketStatus = 'pending' | 'accepted' | 'discarded';

export interface Ticket extends ObjectiveWithRelated {
  status: TicketStatus;
  originalText: string;
}
