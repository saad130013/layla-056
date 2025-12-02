
import React, { createContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { User, UserRole, InspectionReport, ReportStatus, Zone, Location, InspectionForm, Notification, CDR, PenaltyInvoice, PenaltyStatus, GlobalPenaltyStatement } from '../types';
import { USERS, ZONES, LOCATIONS, FORMS, INITIAL_REPORTS, INITIAL_NOTIFICATIONS, INITIAL_CDRS } from '../constants';
import { db, auth } from '../firebase';
import { collection, onSnapshot, setDoc, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

interface AppContextType {
  user: User | null;
  users: User[];
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (user: User) => void;
  deleteUser: (userId: string) => void;
  changePassword: (userId: string, oldPassword: string, newPassword: string) => boolean;
  reports: InspectionReport[];
  submitReport: (report: InspectionReport) => void;
  updateReport: (report: InspectionReport) => void;
  getReportById: (id: string) => InspectionReport | undefined;
  getInspectorById: (id: string) => User | undefined;
  getLocationById: (id: string) => Location | undefined;
  getZoneByLocationId: (locationId: string) => Zone | undefined;
  getFormById: (formId: string) => InspectionForm | undefined;
  zones: Zone[];
  locations: Location[];
  forms: InspectionForm[];
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  notifications: Notification[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  cdrs: CDR[];
  addCDR: (cdr: CDR) => void;
  updateCDR: (cdr: CDR) => void;
  getCDRById: (id: string) => CDR | undefined;
  // Penalty Invoices
  penaltyInvoices: PenaltyInvoice[];
  addPenaltyInvoice: (invoice: PenaltyInvoice) => void;
  updatePenaltyInvoice: (invoice: PenaltyInvoice) => void;
  getPenaltyInvoiceById: (id: string) => PenaltyInvoice | undefined;
  // Global Penalty Statements
  globalPenaltyStatements: GlobalPenaltyStatement[];
  addGlobalPenaltyStatement: (stmt: GlobalPenaltyStatement) => void;
  updateGlobalPenaltyStatement: (stmt: GlobalPenaltyStatement) => void;
  getGlobalPenaltyStatementById: (id: string) => GlobalPenaltyStatement | undefined;
  isFirebaseReady: boolean;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(USERS);
  
  // Data States
  const [reports, setReports] = useState<InspectionReport[]>(INITIAL_REPORTS);
  const [cdrs, setCdrs] = useState<CDR[]>(INITIAL_CDRS);
  const [penaltyInvoices, setPenaltyInvoices] = useState<PenaltyInvoice[]>([]);
  const [globalPenaltyStatements, setGlobalPenaltyStatements] = useState<GlobalPenaltyStatement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Flag to indicate if we are running on Firebase or Fallback
  const isFirebaseReady = !!(db && auth);

  // ==========================================================================
  // FIREBASE REAL-TIME LISTENERS (Only if DB is available)
  // ==========================================================================
  useEffect(() => {
    if (!db || !auth) return; // Skip if no Firebase keys

    const reportsUnsub = onSnapshot(collection(db, "reports"), (snapshot) => {
      const loadedReports = snapshot.docs.map(doc => doc.data() as InspectionReport);
      setReports(loadedReports); // Always source from DB if connected
    });

    const cdrsUnsub = onSnapshot(collection(db, "cdrs"), (snapshot) => {
      const loadedCDRs = snapshot.docs.map(doc => doc.data() as CDR);
      setCdrs(loadedCDRs);
    });

    const invoicesUnsub = onSnapshot(collection(db, "penaltyInvoices"), (snapshot) => {
      const loadedInvoices = snapshot.docs.map(doc => doc.data() as PenaltyInvoice);
      setPenaltyInvoices(loadedInvoices);
    });

    const gpsUnsub = onSnapshot(collection(db, "globalPenaltyStatements"), (snapshot) => {
      const loadedGPS = snapshot.docs.map(doc => doc.data() as GlobalPenaltyStatement);
      setGlobalPenaltyStatements(loadedGPS);
    });

    return () => {
      reportsUnsub();
      cdrsUnsub();
      invoicesUnsub();
      gpsUnsub();
    };
  }, []);

  // ==========================================================================
  // AUTHENTICATION (HYBRID)
  // ==========================================================================
  
  // Listen for Firebase Auth State Changes
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser && firebaseUser.email) {
            // Find user in USERS array to get Role (In production this would come from a 'users' collection in Firestore)
            const matchedUser = USERS.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
            if (matchedUser) {
                setUser({ ...matchedUser, uid: firebaseUser.uid });
            } else {
                console.warn("User logged in via Firebase but not found in local user list (for role mapping).");
            }
        } else {
            setUser(null);
        }
    });
    return () => unsubscribe();
  }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<boolean> => {
    // FALLBACK MODE (If no Firebase Auth)
    if (!auth) {
        console.log("Firebase Auth not configured. Using Mock Login.");
        const cleanIdentifier = identifier.trim().toLowerCase();
        const foundUser = users.find(u => 
            (u.username.toLowerCase() === cleanIdentifier || u.email.toLowerCase() === cleanIdentifier) && 
            u.password === password.trim()
        );
        if (foundUser) {
            setUser(foundUser);
            return true;
        }
        return false;
    }

    // FIREBASE MODE
    try {
        await signInWithEmailAndPassword(auth, identifier, password);
        return true;
    } catch (error) {
        console.error("Firebase Login Error:", error);
        return false;
    }
  }, [users]);

  const logout = useCallback(async () => {
    if (!auth) {
        setUser(null); // Fallback logout
        return;
    }
    await signOut(auth);
  }, []);

  // ==========================================================================
  // DATA ACTIONS (HYBRID)
  // ==========================================================================

  const submitReport = useCallback(async (report: InspectionReport) => {
    if (db) {
        try { await setDoc(doc(db, "reports", report.id), report); } catch (e) { console.error(e); }
    } else {
        setReports(prev => [...prev, report]);
    }
  }, []);

  const updateReport = useCallback(async (updatedReport: InspectionReport) => {
    if (db) {
        try { await setDoc(doc(db, "reports", updatedReport.id), updatedReport); } catch (e) { console.error(e); }
    } else {
        setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
    }
  }, []);

  const addCDR = useCallback(async (cdr: CDR) => {
    if (db) {
        try { await setDoc(doc(db, "cdrs", cdr.id), cdr); } catch (e) { console.error(e); }
    } else {
        setCdrs(prev => [cdr, ...prev]);
    }
  }, []);

  const updateCDR = useCallback(async (updatedCDR: CDR) => {
    if (db) {
        try { await setDoc(doc(db, "cdrs", updatedCDR.id), updatedCDR); } catch (e) { console.error(e); }
    } else {
        setCdrs(prev => prev.map(c => c.id === updatedCDR.id ? updatedCDR : c));
    }
  }, []);

  const addPenaltyInvoice = useCallback(async (invoice: PenaltyInvoice) => {
    if (db) {
        try { await setDoc(doc(db, "penaltyInvoices", invoice.id), invoice); } catch (e) { console.error(e); }
    } else {
        setPenaltyInvoices(prev => [invoice, ...prev]);
    }
  }, []);

  const updatePenaltyInvoice = useCallback(async (invoice: PenaltyInvoice) => {
    if (db) {
        try { await setDoc(doc(db, "penaltyInvoices", invoice.id), invoice); } catch (e) { console.error(e); }
    } else {
        setPenaltyInvoices(prev => prev.map(inv => inv.id === invoice.id ? invoice : inv));
    }
  }, []);

  const addGlobalPenaltyStatement = useCallback(async (stmt: GlobalPenaltyStatement) => {
    if (db) {
        try { await setDoc(doc(db, "globalPenaltyStatements", stmt.id), stmt); } catch (e) { console.error(e); }
    } else {
        setGlobalPenaltyStatements(prev => [stmt, ...prev]);
    }
  }, []);

  const updateGlobalPenaltyStatement = useCallback(async (updatedStmt: GlobalPenaltyStatement) => {
    if (db) {
        try { await setDoc(doc(db, "globalPenaltyStatements", updatedStmt.id), updatedStmt); } catch (e) { console.error(e); }
    } else {
        setGlobalPenaltyStatements(prev => prev.map(s => s.id === updatedStmt.id ? updatedStmt : s));
    }
  }, []);

  // ==========================================================================
  // HELPERS (No DB dependency)
  // ==========================================================================

  const addUser = useCallback((userToAdd: Omit<User, 'id'>) => {
    const newUser: User = { ...userToAdd, id: `user-${Date.now()}` };
    setUsers(prev => [...prev, newUser]);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (user?.id === updatedUser.id) setUser(updatedUser);
  }, [user]);

  const deleteUser = useCallback((userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
  }, []);

  const changePassword = useCallback((userId: string, oldPassword: string, newPassword: string): boolean => {
    // Local mock password change only
    const userToUpdate = users.find(u => u.id === userId);
    if (userToUpdate && userToUpdate.password === oldPassword) {
      const updatedUser = { ...userToUpdate, password: newPassword };
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      if (user?.id === userId) setUser(updatedUser);
      return true;
    }
    return false;
  }, [users, user]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);
  
  // Getters
  const getReportById = useCallback((id: string) => reports.find(r => r.id === id), [reports]);
  const getInspectorById = useCallback((id: string) => users.find(u => u.id === id), [users]);
  const getLocationById = useCallback((id: string) => LOCATIONS.find(l => l.id === id), []);
  const getZoneByLocationId = useCallback((locationId: string) => {
    const location = LOCATIONS.find(l => l.id === locationId);
    return location ? ZONES.find(z => z.id === location.zoneId) : undefined;
  }, []);
  const getFormById = useCallback((formId: string) => FORMS.find(f => f.id === formId), []);
  const getCDRById = useCallback((id: string) => cdrs.find(c => c.id === id), [cdrs]);
  const getPenaltyInvoiceById = useCallback((id: string) => penaltyInvoices.find(inv => inv.id === id), [penaltyInvoices]);
  const getGlobalPenaltyStatementById = useCallback((id: string) => globalPenaltyStatements.find(s => s.id === id), [globalPenaltyStatements]);

  // Notifications
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const value = useMemo(() => ({
    user, users, login, logout, addUser, updateUser, deleteUser, changePassword,
    reports, submitReport, updateReport,
    getReportById, getInspectorById, getLocationById, getZoneByLocationId, getFormById,
    zones: ZONES, locations: LOCATIONS, forms: FORMS,
    theme, toggleTheme,
    notifications, markNotificationAsRead, markAllNotificationsAsRead,
    cdrs, addCDR, updateCDR, getCDRById,
    penaltyInvoices, addPenaltyInvoice, updatePenaltyInvoice, getPenaltyInvoiceById,
    globalPenaltyStatements, addGlobalPenaltyStatement, updateGlobalPenaltyStatement, getGlobalPenaltyStatementById,
    isFirebaseReady
  }), [user, users, reports, theme, notifications, cdrs, penaltyInvoices, globalPenaltyStatements, isFirebaseReady, login, logout, addUser, updateUser, deleteUser, changePassword, submitReport, updateReport, getReportById, getInspectorById, getLocationById, getZoneByLocationId, getFormById, toggleTheme, markNotificationAsRead, markAllNotificationsAsRead, addCDR, updateCDR, getCDRById, addPenaltyInvoice, updatePenaltyInvoice, getPenaltyInvoiceById, addGlobalPenaltyStatement, updateGlobalPenaltyStatement, getGlobalPenaltyStatementById]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
