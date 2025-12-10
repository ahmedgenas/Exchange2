
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Branch, Product, Stock, TransferRequest, UserRole, RequestStatus, ShortageReport, Notification, InventoryAuditStatus, SystemConfig, FirebaseConfig } from '../types';
import { initFirebase, subscribeToCollection, fbAdd, fbUpdate, fbDelete, getDb } from '../services/firebase';

// --- Initial Data (Seeds) - Fallback only ---

const INITIAL_BRANCHES: Branch[] = Array.from({ length: 5 }, (_, i) => ({
  id: `b-${i + 1}`,
  name: `فرع الطيبي ${i + 1} - ${['جناكليس', 'سوريا', 'ونجت', 'فلمنج2', 'فلمنج','رشدي'][i]}`,
  location: { lat: 30.0 + (Math.random() * 0.1), lng: 31.2 + (Math.random() * 0.1) },
  address: `الاسكندرية`
}));

const INITIAL_PRODUCTS: Product[] = [
  { code: '1001', name: 'Panadol Extra', barcode: '622112233', isFridge: false },
  { code: '1002', name: 'Augmentin 1g', barcode: '622445566', isFridge: false },
  { code: '1003', name: 'Cataflam 50mg', barcode: '622778899', isFridge: false },
  { code: '1004', name: 'Insulin Lantus', barcode: '622001122', isFridge: true }, 
  { code: '1005', name: 'Antinal', barcode: '622334455', isFridge: false },
];

const INITIAL_STOCK: Stock[] = [];
INITIAL_BRANCHES.forEach(branch => {
  INITIAL_PRODUCTS.forEach(prod => {
    if (Math.random() > 0.2) { 
      INITIAL_STOCK.push({
        id: `${branch.id}_${prod.code}`,
        branchId: branch.id,
        productCode: prod.code,
        quantity: Math.floor(Math.random() * 50) + 5
      });
    }
  });
});

const INITIAL_USERS: User[] = [
  { id: 'admin', username: 'admin', password: '123', name: 'مدير النظام', role: UserRole.ADMIN },
  { id: 'dist', username: 'dist', password: '123', name: 'مسئول التوزيع', role: UserRole.DISTRIBUTION },
  { id: 'driver1', username: 'driver1', password: '123', name: 'مصطفي سائق', role: UserRole.DELIVERY },
  { id: 'inv', username: 'inventory', password: '123', name: 'مسئول الجرد', role: UserRole.INVENTORY_MANAGER },
  { id: 'shortage', username: 'shortage', password: '123', name: 'مسئول النواقص', role: UserRole.SHORTAGE_MANAGER },
  ...INITIAL_BRANCHES.map(b => ({
    id: `user-${b.id}`,
    username: `user-${b.id}`,
    password: '123',
    name: `صيدلي ${b.name}`,
    role: UserRole.BRANCH_MANAGER,
    branchId: b.id
  }))
];

// --- Helper: Local Storage ---
const loadFromStorage = <T,>(key: string, initialValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage`, error);
    return initialValue;
  }
};

const getDistance = (loc1: {lat: number, lng: number}, loc2: {lat: number, lng: number}) => {
  if (!loc1 || !loc2) return 999999;
  const R = 6371e3; 
  const φ1 = loc1.lat * Math.PI/180;
  const φ2 = loc2.lat * Math.PI/180;
  const Δφ = (loc2.lat-loc1.lat) * Math.PI/180;
  const Δλ = (loc2.lng-loc1.lng) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

interface SheetLinks {
    products: string;
    branches: string;
    stock: string;
}

interface StoreContextType {
  currentUser: User | null;
  login: (username: string, password?: string) => boolean;
  logout: () => void;
  updateUserLocation: (lat: number, lng: number) => void;
  updateUser: (userId: string, data: Partial<User>) => void;
  
  users: User[];
  branches: Branch[];
  products: Product[];
  stocks: Stock[];
  requests: TransferRequest[];
  shortageReports: ShortageReport[];
  
  sheetLinks: SheetLinks;
  updateSheetLinks: (links: SheetLinks) => void;
  refreshDataFromSheets: (isAuto?: boolean) => Promise<string>;
  lastSyncTime: number | null;
  
  notifications: Notification[];
  addNotification: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeNotification: (id: string) => void;

  addUser: (user: User) => void;
  addBranch: (branch: Branch) => void;
  editBranch: (branch: Branch) => void;
  deleteBranch: (branchId: string) => void;
  addProduct: (product: Product) => void;
  editProduct: (product: Product) => void;
  deleteProduct: (productCode: string) => void;
  updateStock: (branchId: string, productCode: string, quantity: number) => void;
  deleteStock: (branchId: string, productCode: string) => void;
  bulkImportProducts: (newProducts: Product[], replace?: boolean) => void;
  bulkImportBranches: (newBranches: Branch[], replace?: boolean) => void;
  bulkImportStock: (newStocks: Stock[], replace?: boolean) => void;

  createRequest: (requesterBranchId: string, productCode: string, quantity: number) => void;
  createBulkRequest: (requesterBranchId: string, items: {productCode: string, quantity: number}[]) => void;
  updateRequestQuantity: (requestId: string, newQuantity: number) => void;
  approveRequest: (requestId: string, issueNumber: string, issuedQuantity: number) => void;
  rejectRequest: (requestId: string, reason: string) => void;
  cancelRequest: (requestId: string) => void;
  deleteRequest: (requestId: string) => void;
  assignDriver: (requestId: string, driverId: string) => void;
  confirmPickup: (requestId: string) => void; 
  completeDelivery: (requestId: string) => void;
  confirmReception: (requestId: string, receiptNumber: string) => void;
  
  reportShortage: (requesterBranchId: string, productCode: string, quantity: number) => void;
  resolveShortage: (reportId: string, providedQuantity: number) => void;
  archiveShortageNotification: (reportId: string) => void;
  resolveDiscrepancy: (requestId: string, status: InventoryAuditStatus, note: string) => void;

  // System Configuration
  systemConfig: SystemConfig;
  updateSystemConfig: (config: SystemConfig) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
      apiKey: "AIzaSyBrZRGZF9ZafawLIMQQ_tZai9wyDljZk6g",
      authDomain: "tay-group-exchange-system.firebaseapp.com",
      projectId: "tay-group-exchange-system",
      storageBucket: "tay-group-exchange-system.firebasestorage.app",
      messagingSenderId: "735569182938",
      appId: "1:735569182938:web:b49746862bed0df1b6a5e3"
  };

  // System Config - Defaults to CLOUD with provided config if storage is empty
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => 
      loadFromStorage('tay_sys_config', { 
          mode: 'CLOUD', 
          firebase: DEFAULT_FIREBASE_CONFIG 
      })
  );

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [shortageReports, setShortageReports] = useState<ShortageReport[]>([]);
  
  const [sheetLinks, setSheetLinks] = useState<SheetLinks>(() => loadFromStorage('tay_sheet_links', { products: '', branches: '', stock: '' }));
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => loadFromStorage('tay_last_sync', null));
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const prevRequestsRef = useRef<TransferRequest[]>([]);
  const isCloudInitialized = useRef(false);
  const permissionErrorShown = useRef(false);

  // --- Notification & Audio Logic ---
  const addNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setNotifications(prev => [...prev, { id, message, type, timestamp: Date.now() }]);
    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, 7000);
  };
  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

  // --- INITIALIZATION ---
  useEffect(() => {
    if (systemConfig.mode === 'CLOUD' && systemConfig.firebase && !isCloudInitialized.current) {
        // Init Firebase
        const success = initFirebase(systemConfig.firebase);
        if (success) {
            isCloudInitialized.current = true;
            permissionErrorShown.current = false;
            console.log("Subscribing to Cloud Collections...");

            const handleFbError = (err: any) => {
                 if (!permissionErrorShown.current) {
                    // Check specifically for permission errors
                    if (err.code === 'permission-denied') {
                        addNotification("خطأ صلاحيات: يرجى تحديث Firestore Rules في لوحة تحكم Firebase لتكون 'allow read, write: if true;'", 'error');
                    } else {
                        addNotification(`خطأ في الاتصال بقاعدة البيانات: ${err.code || err.message}`, 'error');
                    }
                    permissionErrorShown.current = true;
                 }
            };

            // Subscribe to Collections with error handling
            const unsub1 = subscribeToCollection('users', (data) => setUsers(data as User[]), handleFbError);
            const unsub2 = subscribeToCollection('branches', (data) => setBranches(data as Branch[]), handleFbError);
            const unsub3 = subscribeToCollection('products', (data) => setProducts(data as Product[]), handleFbError);
            const unsub4 = subscribeToCollection('stocks', (data) => setStocks(data as Stock[]), handleFbError);
            const unsub5 = subscribeToCollection('requests', (data) => setRequests(data as TransferRequest[]), handleFbError);
            const unsub6 = subscribeToCollection('shortages', (data) => setShortageReports(data as ShortageReport[]), handleFbError);
            
            return () => {
                unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6();
            };
        } else {
            console.error("Failed to init Firebase, falling back to local?");
            addNotification("فشل تهيئة Firebase. تأكد من صحة الإعدادات.", "error");
        }
    } else if (systemConfig.mode === 'LOCAL') {
        // Load Local Storage
        setUsers(loadFromStorage('tay_users', INITIAL_USERS));
        setBranches(loadFromStorage('tay_branches', INITIAL_BRANCHES));
        setProducts(loadFromStorage('tay_products', INITIAL_PRODUCTS));
        setStocks(loadFromStorage('tay_stocks', INITIAL_STOCK));
        setRequests(loadFromStorage('tay_requests', []));
        setShortageReports(loadFromStorage('tay_shortages', []));
    }
  }, [systemConfig.mode, systemConfig.firebase]);

  // --- LOCAL PERSISTENCE (Only if mode is LOCAL) ---
  useEffect(() => {
      if (systemConfig.mode === 'LOCAL') {
          localStorage.setItem('tay_users', JSON.stringify(users));
          localStorage.setItem('tay_branches', JSON.stringify(branches));
          localStorage.setItem('tay_products', JSON.stringify(products));
          localStorage.setItem('tay_stocks', JSON.stringify(stocks));
          localStorage.setItem('tay_requests', JSON.stringify(requests));
          localStorage.setItem('tay_shortages', JSON.stringify(shortageReports));
      }
  }, [users, branches, products, stocks, requests, shortageReports, systemConfig.mode]);

  useEffect(() => { localStorage.setItem('tay_sys_config', JSON.stringify(systemConfig)); }, [systemConfig]);
  useEffect(() => { localStorage.setItem('tay_sheet_links', JSON.stringify(sheetLinks)); }, [sheetLinks]);

  // --- ACTIONS WRAPPERS (CLOUD AWARE) ---
  const saveAction = (coll: string, data: any, isAdd = false, id?: string) => {
      if (systemConfig.mode === 'CLOUD' && getDb()) {
          // Robust sanitation: Remove undefined fields which Firestore hates
          const cleanData = JSON.parse(JSON.stringify(data));

          if (isAdd) {
              fbAdd(coll, cleanData);
          } else if (id) {
              fbUpdate(coll, id, cleanData);
          }
      } else {
          // Local State Update handled by the setX functions in the specific methods below
      }
  };

  const deleteAction = (coll: string, id: string) => {
      if (systemConfig.mode === 'CLOUD' && getDb()) {
          fbDelete(coll, id);
      }
  };

  const updateSystemConfig = (config: SystemConfig) => {
      setSystemConfig(config);
      if (config.mode === 'CLOUD') {
          window.location.reload(); // Simple reload to ensure clean init
      }
  };

  const updateSheetLinks = (links: SheetLinks) => {
    setSheetLinks(links);
  };

  // --- DOMAIN LOGIC ---
  const getEffectiveStock = useCallback((branchId: string, productCode: string) => {
      const stockItem = stocks.find(s => s.branchId === branchId && s.productCode === productCode);
      return stockItem ? stockItem.quantity : 0;
  }, [stocks]);

  const hasActiveRequest = useCallback((requesterId: string, targetId: string, productCode: string) => {
      return requests.some(r => 
          r.requesterBranchId === requesterId &&
          r.targetBranchId === targetId &&
          r.productCode === productCode &&
          (r.status === RequestStatus.PENDING || 
           r.status === RequestStatus.APPROVED || 
           r.status === RequestStatus.DISTRIBUTION || 
           r.status === RequestStatus.ASSIGNED || 
           r.status === RequestStatus.PICKED_UP)
      );
  }, [requests]);

  const findNextBranch = useCallback((requesterId: string, productCode: string, quantity: number, triedBranches: string[]) => {
    const requester = branches.find(b => b.id === requesterId);
    if (!requester) return null;
    const validBranches = branches.filter(b => 
      b.id !== requesterId && !triedBranches.includes(b.id) && !hasActiveRequest(requesterId, b.id, productCode) &&
      getEffectiveStock(b.id, productCode) >= quantity
    );
    if (validBranches.length === 0) return null;
    validBranches.sort((a, b) => getDistance(requester.location, a.location) - getDistance(requester.location, b.location));
    return validBranches[0];
  }, [branches, getEffectiveStock, hasActiveRequest]);

  // --- CRUD Implementations ---
  
  const createRequest = (requesterBranchId: string, productCode: string, quantity: number) => {
      createBulkRequest(requesterBranchId, [{productCode, quantity}]);
  };

  const createBulkRequest = (requesterBranchId: string, items: {productCode: string, quantity: number}[]) => {
      const newRequests: TransferRequest[] = [];
      const stockUpdates: {id?: string, branchId: string, productCode: string, delta: number}[] = [];

      const requester = branches.find(b => b.id === requesterBranchId);

      for(const item of items) {
           const nextBranch = findNextBranch(requesterBranchId, item.productCode, item.quantity, []);
           if (nextBranch) {
                const req: TransferRequest = {
                    id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    requesterBranchId,
                    targetBranchId: nextBranch.id,
                    productCode: item.productCode,
                    quantity: item.quantity,
                    status: RequestStatus.PENDING,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 30 * 60 * 1000,
                    attemptedBranchIds: [nextBranch.id]
                };
                newRequests.push(req);
                stockUpdates.push({ branchId: nextBranch.id, productCode: item.productCode, delta: -item.quantity });
           } else {
               addNotification(`لم يتم العثور على فرع يمتلك الكمية الكاملة للصنف ${item.productCode}`, 'warning');
           }
      }

      if (systemConfig.mode === 'CLOUD') {
          newRequests.forEach(r => saveAction('requests', r, true));
          stockUpdates.forEach(u => {
             const s = stocks.find(s => s.branchId === u.branchId && s.productCode === u.productCode);
             if(s && s.id) {
                 saveAction('stocks', { quantity: Math.max(0, s.quantity + u.delta) }, false, s.id);
             }
          });
          addNotification('تم إرسال الطلبات للسحابة', 'success');
      } else {
          setRequests(prev => [...prev, ...newRequests]);
          setStocks(prev => {
              const next = [...prev];
              stockUpdates.forEach(u => {
                  const idx = next.findIndex(s => s.branchId === u.branchId && s.productCode === u.productCode);
                  if(idx !== -1) next[idx] = { ...next[idx], quantity: Math.max(0, next[idx].quantity + u.delta) };
              });
              return next;
          });
          addNotification('تم إنشاء الطلبات محلياً', 'success');
      }
  };
  
  const updateStock = (branchId: string, productCode: string, quantity: number) => {
      const existing = stocks.find(s => s.branchId === branchId && s.productCode === productCode);
      if (systemConfig.mode === 'CLOUD') {
          if (existing && existing.id) {
              saveAction('stocks', { quantity }, false, existing.id);
          } else {
              saveAction('stocks', { branchId, productCode, quantity, id: `${branchId}_${productCode}` }, true);
          }
      } else {
          setStocks(prev => {
              if (existing) return prev.map(s => s === existing ? { ...s, quantity } : s);
              return [...prev, { branchId, productCode, quantity, id: `${branchId}_${productCode}` }];
          });
      }
  };

  const deleteStock = (branchId: string, productCode: string) => {
       const existing = stocks.find(s => s.branchId === branchId && s.productCode === productCode);
       if (existing) {
           if (systemConfig.mode === 'CLOUD' && existing.id) deleteAction('stocks', existing.id);
           else setStocks(prev => prev.filter(s => s !== existing));
       }
  };

  const approveRequest = (requestId: string, issueNumber: string, issuedQuantity: number) => {
      const req = requests.find(r => r.id === requestId);
      if (!req) return;
      const deficit = req.quantity - issuedQuantity;
      
      const updates: any = {
          status: RequestStatus.DISTRIBUTION,
          issueNumber,
          issuedQuantity,
          updatedAt: Date.now(),
          respondedAt: Date.now()
      };
      
      if(deficit > 0) {
          updates.inventoryStatus = InventoryAuditStatus.PENDING;
      }
      
      if (systemConfig.mode === 'CLOUD') {
          saveAction('requests', updates, false, requestId);
          if(deficit > 0) {
             const s = stocks.find(stock => stock.branchId === req.targetBranchId && stock.productCode === req.productCode);
             if(s && s.id) saveAction('stocks', { quantity: s.quantity + deficit }, false, s.id);
          }
      } else {
          setRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updates } : r));
          if(deficit > 0) {
             setStocks(prev => prev.map(s => (s.branchId === req.targetBranchId && s.productCode === req.productCode) ? { ...s, quantity: s.quantity + deficit } : s));
          }
      }
      addNotification('تم قبول الطلب', 'success');
  };

  const rejectRequest = (requestId: string, reason: string) => {
      const req = requests.find(r => r.id === requestId);
      if (!req) return;
      
      if (systemConfig.mode === 'CLOUD') {
          saveAction('requests', { 
            status: RequestStatus.REJECTED, 
            rejectionReason: reason, 
            updatedAt: Date.now(), 
            respondedAt: Date.now() 
          }, false, requestId);
          const s = stocks.find(stock => stock.branchId === req.targetBranchId && stock.productCode === req.productCode);
          if(s && s.id) saveAction('stocks', { quantity: s.quantity + req.quantity }, false, s.id);
      } else {
          setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: RequestStatus.REJECTED, rejectionReason: reason, updatedAt: Date.now(), respondedAt: Date.now() } : r));
          setStocks(prev => prev.map(s => (s.branchId === req.targetBranchId && s.productCode === req.productCode) ? { ...s, quantity: s.quantity + req.quantity } : s));
      }
      addNotification('تم رفض الطلب', 'info');
  };

  const simpleUpdateReq = (id: string, data: any) => {
      if(systemConfig.mode === 'CLOUD') saveAction('requests', data, false, id);
      else setRequests(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  };

  const assignDriver = (id: string, driverId: string) => {
      simpleUpdateReq(id, { status: RequestStatus.ASSIGNED, driverId, updatedAt: Date.now() });
      addNotification('تم تعيين المندوب', 'success');
  };
  
  const confirmPickup = (id: string) => {
      simpleUpdateReq(id, { status: RequestStatus.PICKED_UP, pickedUpAt: Date.now(), updatedAt: Date.now() });
      addNotification('تم الاستلام', 'success');
  };

  const completeDelivery = (id: string) => {
      simpleUpdateReq(id, { status: RequestStatus.DELIVERED, deliveredAt: Date.now(), updatedAt: Date.now() });
      addNotification('تم التوصيل', 'success');
  };

  const confirmReception = (id: string, receiptNumber: string) => {
      simpleUpdateReq(id, { status: RequestStatus.COMPLETED, receiptNumber, updatedAt: Date.now() });
      const req = requests.find(r => r.id === id);
      if (req) {
         const qty = req.issuedQuantity || req.quantity;
         updateStock(req.requesterBranchId, req.productCode, getEffectiveStock(req.requesterBranchId, req.productCode) + qty);
      }
      addNotification('تم الاستلام وإضافة الرصيد', 'success');
  };

  const cancelRequest = (id: string) => {
      const req = requests.find(r => r.id === id);
      simpleUpdateReq(id, { status: RequestStatus.CANCELLED, updatedAt: Date.now() });
      if (req && req.status === RequestStatus.PENDING) {
          updateStock(req.targetBranchId, req.productCode, getEffectiveStock(req.targetBranchId, req.productCode) + req.quantity);
      }
      addNotification('تم الإلغاء', 'info');
  };

  const updateRequestQuantity = (id: string, qty: number) => {
      simpleUpdateReq(id, { quantity: qty, updatedAt: Date.now() });
  };

  const deleteRequest = (id: string) => {
      if(systemConfig.mode === 'CLOUD') deleteAction('requests', id);
      else setRequests(prev => prev.filter(r => r.id !== id));
      addNotification('تم الحذف', 'info');
  };
  
  // Standard Admin CRUD wrappers
  const addUser = (u: User) => { 
      if(systemConfig.mode === 'CLOUD') saveAction('users', u, true, u.id);
      else setUsers(p => [...p, u]); 
  };
  const addBranch = (b: Branch) => { 
      if(systemConfig.mode === 'CLOUD') saveAction('branches', b, true, b.id);
      else setBranches(p => [...p, b]); 
  };
  const editBranch = (b: Branch) => { 
      if(systemConfig.mode === 'CLOUD') saveAction('branches', b, false, b.id);
      else setBranches(p => p.map(x => x.id === b.id ? b : x)); 
  };
  const deleteBranch = (id: string) => { 
      if(systemConfig.mode === 'CLOUD') deleteAction('branches', id);
      else setBranches(p => p.filter(x => x.id !== id)); 
  };
  const addProduct = (p: Product) => { 
      if(systemConfig.mode === 'CLOUD') saveAction('products', p, true, p.code);
      else setProducts(pArr => [...pArr, p]); 
  };
  const editProduct = (p: Product) => { 
       if(systemConfig.mode === 'CLOUD') { 
           saveAction('products', p, false, p.code);
       }
       else setProducts(pArr => pArr.map(x => x.code === p.code ? p : x));
  };
  const deleteProduct = (c: string) => { 
       if(systemConfig.mode === 'CLOUD') { 
           deleteAction('products', c);
       }
       else setProducts(p => p.filter(x => x.code !== c));
  };
  
  // User Profile Update
  const updateUser = (userId: string, data: Partial<User>) => {
      if(systemConfig.mode === 'CLOUD') {
          saveAction('users', data, false, userId);
          if (currentUser && currentUser.id === userId) {
             setCurrentUser(prev => prev ? { ...prev, ...data } : null);
          }
      } else {
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
          if (currentUser && currentUser.id === userId) {
             setCurrentUser(prev => prev ? { ...prev, ...data } : null);
          }
      }
      addNotification('تم تحديث البيانات بنجاح', 'success');
  };

  const updateUserLocation = (lat: number, lng: number) => {
      if (!currentUser) return;
      const updated = { ...currentUser, lastLocation: { lat, lng, timestamp: Date.now() } };
      if (systemConfig.mode === 'CLOUD') {
          saveAction('users', updated, false, currentUser.id);
      } else {
          setUsers(prev => prev.map(u => u.id === currentUser.id ? updated : u));
      }
  };

  const reportShortage = (bid: string, code: string, qty: number) => {
      const rep: ShortageReport = { id: `sh-${Date.now()}`, requesterBranchId: bid, productCode: code, requestedQuantity: qty, createdAt: Date.now(), status: 'OPEN' };
      if(systemConfig.mode === 'CLOUD') saveAction('shortages', rep, true);
      else setShortageReports(p => [...p, rep]);
  };
  const resolveShortage = (id: string, qty: number) => {
      if(systemConfig.mode === 'CLOUD') saveAction('shortages', { status: 'RESOLVED', providedQuantity: qty, resolvedAt: Date.now() }, false, id);
      else setShortageReports(p => p.map(r => r.id === id ? { ...r, status: 'RESOLVED', providedQuantity: qty, resolvedAt: Date.now() } : r));
  };
  const archiveShortageNotification = (id: string) => {
      if(systemConfig.mode === 'CLOUD') saveAction('shortages', { archivedByRequester: true }, false, id);
      else setShortageReports(prev => prev.map(r => r.id === id ? { ...r, archivedByRequester: true } : r));
  };

  const resolveDiscrepancy = (requestId: string, status: InventoryAuditStatus, note: string) => {
      if(systemConfig.mode === 'CLOUD') saveAction('requests', { inventoryStatus: status, inventoryNote: note }, false, requestId);
      else setRequests(prev => prev.map(r => r.id === requestId ? { ...r, inventoryStatus: status, inventoryNote: note } : r));
      addNotification('تم تحديث حالة الجرد', 'success');
  };

  const login = (username: string, password?: string) => {
    const user = users.find(u => u.username === username);
    if (user) {
        // Validate password if user has one, otherwise accept (legacy support)
        if (user.password && user.password !== password) {
            addNotification("كلمة المرور غير صحيحة", "error");
            return false;
        }
        setCurrentUser(user);
        return true;
    }
    addNotification("اسم المستخدم غير موجود", "error");
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const refreshDataFromSheets = async (isAuto = false) => {
      return "Feature not implemented in this version";
  };
  
  const bulkImportProducts = (newProducts: Product[]) => {
      if(systemConfig.mode === 'CLOUD') {
          newProducts.forEach(p => saveAction('products', p, true, p.code));
      } else {
          setProducts(prev => [...prev, ...newProducts]);
      }
  };
  const bulkImportBranches = (newBranches: Branch[]) => {
       if(systemConfig.mode === 'CLOUD') {
          newBranches.forEach(b => saveAction('branches', b, true, b.id));
      } else {
          setBranches(prev => [...prev, ...newBranches]);
      }
  };
  const bulkImportStock = (newStocks: Stock[]) => {
       if(systemConfig.mode === 'CLOUD') {
          newStocks.forEach(s => saveAction('stocks', s, true, s.id || `${s.branchId}_${s.productCode}`));
      } else {
          setStocks(prev => [...prev, ...newStocks]);
      }
  };

  const value: StoreContextType = {
    currentUser,
    login,
    logout,
    updateUserLocation,
    updateUser,
    users,
    branches,
    products,
    stocks,
    requests,
    shortageReports,
    sheetLinks,
    updateSheetLinks,
    refreshDataFromSheets,
    lastSyncTime,
    notifications,
    addNotification,
    removeNotification,
    addUser,
    addBranch,
    editBranch,
    deleteBranch,
    addProduct,
    editProduct,
    deleteProduct,
    updateStock,
    deleteStock,
    bulkImportProducts,
    bulkImportBranches,
    bulkImportStock,
    createRequest,
    createBulkRequest,
    updateRequestQuantity,
    approveRequest,
    rejectRequest,
    cancelRequest,
    deleteRequest,
    assignDriver,
    confirmPickup,
    completeDelivery,
    confirmReception,
    reportShortage,
    resolveShortage,
    archiveShortageNotification,
    resolveDiscrepancy,
    systemConfig,
    updateSystemConfig
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
