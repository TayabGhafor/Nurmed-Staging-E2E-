import { Patient } from "../(pages)/(dashboard)/interfaces";

export interface OfflineSession {
  id: string;
  tempId: string;
  mrn: string;
  episode_id?: string;
  department: string;
  language: string;
  name: string;
  status: string;
  dateOfBirth: string;
  date: string;
  recording: Blob;
  hospital_data?: any;
  createdAt: number;
  // For updates: the existing session ID to update
  sessionId?: string;
  isUpdate?: boolean;
  userEmail: string; // Email of the user who created this offline session
}

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'nurmedRecordingsDB';
  private readonly STORE_NAME = 'offlineSessions';
  private readonly DB_VERSION = 2; // Incremented to add userEmail field and index

  constructor() {
    if (typeof window !== 'undefined') {
      this.openDB();
    }
  }

  private openDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = (event) => {
        console.error("IndexedDB error:", (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'tempId' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          // Enable blob storage
          store.createIndex('recording', 'recording', { unique: false });
          store.createIndex('userEmail', 'userEmail', { unique: false });
        } else if (oldVersion < 2) {
          // Migration from version 1 to 2: add userEmail index
          const tx = (event.target as IDBOpenDBRequest).transaction;
          if (tx) {
            const store = tx.objectStore(this.STORE_NAME);
            if (!store.indexNames.contains('userEmail')) {
              store.createIndex('userEmail', 'userEmail', { unique: false });
            }
          }
        }
      };
    });
  }

  /**
   * Get current user email from localStorage
   */
  private getUserEmail(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user?.email || null;
      }
    } catch (error) {
      console.error('Failed to get user email from localStorage:', error);
    }
    
    return null;
  }

  async storeOfflineSession(session: OfflineSession): Promise<void> {
    if (!this.db) await this.openDB();
    
    // Ensure userEmail is set - use from session if provided, otherwise get from localStorage
    const sessionWithEmail: OfflineSession = {
      ...session,
      userEmail: session.userEmail || this.getUserEmail() || '',
    };

    // Validate that we have a user email
    if (!sessionWithEmail.userEmail) {
      console.warn('No user email available when storing offline session');
    }

    const tx = this.db!.transaction(this.STORE_NAME, 'readwrite');
    const store = tx.objectStore(this.STORE_NAME);
    const request = store.put(sessionWithEmail);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflineSessions(): Promise<OfflineSession[]> {
    if (!this.db) await this.openDB();
    
    const currentUserEmail = this.getUserEmail();
    
    // If no user email, return empty array (user not logged in)
    if (!currentUserEmail) {
      console.warn('No user email found, returning empty offline sessions');
      return [];
    }

    const tx = this.db!.transaction(this.STORE_NAME, 'readonly');
    const store = tx.objectStore(this.STORE_NAME);
    
    // Use index to filter by userEmail for better performance
    let request: IDBRequest;
    if (store.indexNames.contains('userEmail')) {
      const index = store.index('userEmail');
      request = index.getAll(currentUserEmail);
    } else {
      // Fallback: get all and filter in memory (for older data without index)
      request = store.getAll();
    }

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const allSessions = request.result as OfflineSession[];
        
        // Filter by user email (handles both indexed and non-indexed queries)
        // Also filter out sessions without userEmail (old data from before this feature)
        const filteredSessions = allSessions.filter(
          (session) => session.userEmail && session.userEmail === currentUserEmail
        );
        
        resolve(filteredSessions);
      };
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async removeOfflineSession(tempId: string): Promise<void> {
    if (!this.db) await this.openDB();
    const tx = this.db!.transaction(this.STORE_NAME, 'readwrite');
    const store = tx.objectStore(this.STORE_NAME);
    const request = store.delete(tempId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log(`Successfully deleted offline session with tempId: ${tempId}`);
        resolve();
      };
      request.onerror = () => {
        console.error(`Failed to delete offline session with tempId: ${tempId}`, request.error);
        reject(request.error);
      };
      tx.onerror = () => {
        console.error(`Transaction failed for tempId: ${tempId}`, tx.error);
        reject(tx.error);
      };
    });
  }

  async clearAllOfflineSessions(): Promise<void> {
    if (!this.db) await this.openDB();
    const tx = this.db!.transaction(this.STORE_NAME, 'readwrite');
    const store = tx.objectStore(this.STORE_NAME);
    const request = store.clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();
