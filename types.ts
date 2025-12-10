
export enum UserRole {
  ADMIN = 'ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  DISTRIBUTION = 'DISTRIBUTION',
  DELIVERY = 'DELIVERY',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  SHORTAGE_MANAGER = 'SHORTAGE_MANAGER'
}

export interface User {
  id: string;
  username: string;
  password?: string; // Added password field
  role: UserRole;
  branchId?: string; // Only for branch managers
  name: string;
  lastLocation?: { lat: number; lng: number; timestamp: number }; // GPS Tracking
}

export interface Location {
  lat: number;
  lng: number;
}

export interface Branch {
  id: string;
  name: string;
  location: Location;
  address: string;
}

export interface Product {
  code: string;
  name: string;
  barcode: string;
  isFridge?: boolean; // New flag for fridge items
}

export interface Stock {
  branchId: string;
  productCode: string;
  quantity: number;
  id?: string; // For Firebase
}

export enum RequestStatus {
  PENDING = 'PENDING',       // Waiting for source branch approval
  APPROVED = 'APPROVED',     // Source branch approved (ready for pickup)
  EXPIRED = 'EXPIRED',       // Timer ran out
  REJECTED = 'REJECTED',     // Source branch rejected
  CANCELLED = 'CANCELLED',   // Requester cancelled the request
  DISTRIBUTION = 'DISTRIBUTION', // Assigned to distribution center
  ASSIGNED = 'ASSIGNED',     // Assigned to a driver (Waiting for Pickup)
  PICKED_UP = 'PICKED_UP',   // Driver picked up items (In Transit)
  DELIVERED = 'DELIVERED',   // Delivered to requesting branch location (Pending Confirmation)
  COMPLETED = 'COMPLETED'    // Requesting branch confirmed receipt
}

export enum InventoryAuditStatus {
  PENDING = 'PENDING',            // Needs review
  ITEM_FOUND = 'ITEM_FOUND',      // Item exists, just wasn't sent (Mistake)
  CONFIRMED_DEFICIT = 'CONFIRMED_DEFICIT' // Item is actually missing (Stock Correction needed)
}

export interface TransferRequest {
  id: string;
  requesterBranchId: string;
  targetBranchId: string;
  productCode: string;
  quantity: number; // Requested quantity
  issuedQuantity?: number; // Actual quantity given by source branch
  status: RequestStatus;
  createdAt: number; // timestamp
  updatedAt?: number; // Timestamp of last status change
  respondedAt?: number; // Timestamp when branch responded (Approve/Reject)
  pickedUpAt?: number; // Timestamp when driver confirmed pickup
  deliveredAt?: number; // Timestamp when driver confirmed delivery
  expiresAt: number; // timestamp for the 30 min window
  driverId?: string;
  issueNumber?: string; // The number entered by the source branch
  receiptNumber?: string; // The number entered by the requesting branch upon receipt
  rejectionReason?: string; // Reason for rejection if status is REJECTED
  attemptedBranchIds: string[]; // Track which branches were already tried to avoid loops
  
  // Inventory Audit Fields
  inventoryStatus?: InventoryAuditStatus;
  inventoryNote?: string;
  
  // Added to handle archiving
  archivedByRequester?: boolean;
}

export interface ShortageReport {
  id: string;
  requesterBranchId: string;
  productCode: string;
  requestedQuantity: number;
  providedQuantity?: number; // The quantity secured/found by the shortage manager
  createdAt: number;
  status: 'OPEN' | 'RESOLVED';
  resolvedAt?: number;
  archivedByRequester?: boolean; // If true, hidden from requester dashboard
}

export interface DashboardStats {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  topProducts: {name: string, count: number}[];
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: number;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface SystemConfig {
    mode: 'LOCAL' | 'CLOUD';
    firebase?: FirebaseConfig;
}
