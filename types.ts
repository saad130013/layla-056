export enum UserRole {
  Inspector = 'INSPECTOR',
  Supervisor = 'SUPERVISOR',
  Executive = 'EXECUTIVE',
}

export interface User {
  id: string; // This will be the Firestore Document ID, often same as uid
  uid: string; // Firebase Auth UID, the ultimate source of truth for user identity
  name: string;
  username: string; // Kept for display/legacy
  email: string;    // Primary identifier for login
  password?: string; // NOT stored in Firestore, only for local mock data if needed
  role: UserRole;
}

...
  referenceNumber: string;
  month: number; // 0-11
  year: number;
  status: GlobalPenaltyStatus;
  contractorName: string;
  generatedDate: string;
  approvedDate?: string;
  approvedBy?: string;
  items: GlobalPenaltyItem[];
  totalAmount: number;
  totalViolations: number;
  totalInvoices?: number;
  managerGeneralComment?: string;
}

// ===== Task Management Types =====

export enum TaskStatus {
  Pending = 'PENDING',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  Overdue = 'OVERDUE',
}

/**
 * Represents a scheduled inspection task assigned to a specific inspector
 * for a specific location/zone. This is the core type for the task
 * management / smart scheduling module.
 */
export interface InspectionReport {
  id: string;
  referenceNumber: string;
  inspectorId: string;
  locationId: string;
  date: string;
  status: ReportStatus;
  items: InspectionResultItem[];
  supervisorComment?: string;
  subLocations?: string[];
  batchLocationIds?: string[];

  // 🆕 رابط المهمة الأصلية (إن وجد)
  originatingTaskId?: string;
  // ======================================================================
// 🧩 Task Management Types
// ======================================================================

export enum TaskStatus {
  Pending = 'PENDING',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  Overdue = 'OVERDUE',
}

export interface InspectionTask {
  id: string;
  inspectorId: string;        // المفتش المكلّف
  locationId: string;         // الموقع المستهدف
  riskCategory: RiskCategory; // مستوى خطورة المنطقة
  status: TaskStatus;         // حالة المهمة
  createdAt: string;          // تاريخ إنشاء المهمة
  dueDate?: string;           // تاريخ الاستحقاق (اختياري)
  createdBy: string;          // من أنشأ المهمة (المشرف أو المدير الأعلى)
  notes?: string;             // تعليمات للمفتش

  // روابط بالتقرير والمخالفة الناتجة عن هذه المهمة
  relatedReportId?: string;
  relatedCdrId?: string;
}

}

