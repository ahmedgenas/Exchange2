import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, Firestore, setDoc, writeBatch } from 'firebase/firestore';
import { FirebaseConfig, TransferRequest, Stock, Product, Branch, User, ShortageReport } from '../types';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

export const initFirebase = (config: FirebaseConfig) => {
    try {
        if (!getApps().length) {
            app = initializeApp(config);
        } else {
            app = getApp();
        }
        db = getFirestore(app);
        console.log("Firebase initialized successfully");
        return true;
    } catch (error) {
        console.error("Firebase init error:", error);
        return false;
    }
};

export const getDb = () => db;

// --- Collection References ---
const REQS_COLL = 'requests';
const STOCKS_COLL = 'stocks';
const PRODUCTS_COLL = 'products';
const BRANCHES_COLL = 'branches';
const USERS_COLL = 'users';
const SHORTAGES_COLL = 'shortages';

// --- Subscriptions (Real-time) ---
export const subscribeToCollection = (collName: string, callback: (data: any[]) => void, onError?: (error: any) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, collName));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        callback(data);
    }, (error) => {
        console.error(`Error subscribing to ${collName}:`, error);
        if (onError) onError(error);
    });
};

// --- Operations ---
export const fbAdd = async (collName: string, data: any) => {
    if (!db) return;
    // Use setDoc if ID is provided, else addDoc
    if (data.id) {
        const docRef = doc(db, collName, data.id);
        await setDoc(docRef, data);
        return data.id;
    } else {
        const docRef = await addDoc(collection(db, collName), data);
        return docRef.id;
    }
};

export const fbUpdate = async (collName: string, id: string, data: any) => {
    if (!db) return;
    const docRef = doc(db, collName, id);
    await updateDoc(docRef, data);
};

export const fbDelete = async (collName: string, id: string) => {
    if (!db) return;
    const docRef = doc(db, collName, id);
    await deleteDoc(docRef);
};

// --- Batch Operations (For transactions like Request + Stock update) ---
export const fbBatchUpdateStock = async (updates: {branchId: string, productCode: string, quantity: number, id?: string}[]) => {
    if (!db) return;
    const batch = writeBatch(db);
    
    updates.forEach(update => {
        // Logic to batch update would go here
    });
};