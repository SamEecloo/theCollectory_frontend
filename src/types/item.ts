export interface IItem {
  _id: string;
  collectionId: string;
  properties: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}