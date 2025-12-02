import React, { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { useI18n } from '../hooks/useI18n';
import {
  InspectionTask,
  TaskStatus,
  RiskCategory,
  UserRole,
} from '../types';
import {
  ListChecks,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  UserCircle2,
  MapPin,
  Eye,
  FileWarning,
} from 'lucide-react';

const TaskMonitoringPage: React.FC = () => {
  const {
    user,
    tasks,
    users,
    locations,
    zones,
  } = useContext(AppContext);
  const { t, language } = useI18n();
  const navigate = useNavigate();

  // صلاحيات: فقط المشرف والمدير الأعلى
  if (!user || (user.role !== UserRole.Supervisor && user.role !== UserRole.Executive)) {
    return (
      <div className="p-6 text-center text-gray-500">
        {t('notAuthorized') ?? 'ليست لديك صلاحية لعرض هذه الصفحة.'}
      </div>
    );
  }

  // فلاتر
  const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [inspectorFilter, setInspectorFilter] = useState<'ALL' | string>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskCategory>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const inspectors = users.filter((u) => u.role === UserRole.Inspector);

  const getLocationName = (locationId: string) => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return locationId;
    return loc.name[language] ?? Object.values(loc.name)[0];
  };

  const getZoneName = (locationId: string) => {
    const loc = locations.find((l) => l.id === locationId);
    const zone = zones.find((z) => z.id === loc?.zoneId);
    if (!zone) return '';
    return zone.name?.[language] ?? Object.values(zone.name ?? {})[0] ?? zone.id;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.Pending:
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
            <Clock className="w-3 h-3 me-1" />
            {language === 'ar' ? 'قيد الانتظار' : 'Pending'}
          </span>
        );
      case TaskStatus.InProgress:
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
            <Clock className="w-3 h-3 me-1" />
            {language === 'ar' ? 'جارٍ التنفيذ' : 'In progress'}
          </span>
        );
      case TaskStatus.Completed:
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3 me-1" />
            {language === 'ar' ? 'منجزة' : 'Completed'}
          </span>
        );
      case TaskStatus.Overdue:
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3 me-1" />
            {language === 'ar' ? 'متأخرة' : 'Overdue'}
          </span>
        );
      default:
        return null;
    }
  };

  const renderRiskBadge = (risk: RiskCategory) => {
    if (risk === RiskCategory.High) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="w-3 h-3 me-1" />
          {t('highRisk')}
        </span>
      );
    }
    if (risk === RiskCategory.Medium) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 me-1" />
          {t('mediumRisk')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
        {t('lowRisk')}
      </span>
    );
  };

  const getInspectorName = (inspectorId: string) => {
    const ins = inspectors.find((i) => i.id === inspectorId);
    return ins?.name ?? inspectorId;
  };

  // تجميع الأرقام للملخص العلوي
  const totalTasks = tasks.length;
  const pendingCount = tasks.filter((t) => t.status === TaskStatus.Pending).length;
  const inProgressCount = tasks.filter((t) => t.status === TaskStatus.InProgress).length;
  const completedCount = tasks.filter((t) => t.status === TaskStatus.Completed).length;
  const overdueCount = tasks.filter((t) => t.status === TaskStatus.Overdue).length;

  // تطبيق الفلاتر
  const filteredTasks: InspectionTask[] = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;
      if (inspectorFilter !== 'ALL' && task.inspectorId !== inspectorFilter) return false;
      if (riskFilter !== 'ALL' && task.riskCategory !== riskFilter) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const locName = getLocationName(task.locationId).toLowerCase();
        const zoneName = getZoneName(task.locationId).toLowerCase();
        const inspectorName = getInspectorName(task.inspectorId).toLowerCase();
        if (
          !locName.includes(term) &&
          !zoneName.includes(term) &&
          !inspectorName.includes(term) &&
          !task.notes?.toLowerCase().includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    tasks,
    statusFilter,
    inspectorFilter,
    riskFilter,
    searchTerm,
    language,
  ]);

  return (
    <div className="p-4 sm:p-6">
      {/* العنوان العلوي */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <ListChecks className="w-8 h-8 text-brand-teal" />
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'ar' ? 'مراقبة مهام التفتيش' : 'Inspection Task Monitoring'}
            </h1>
            <p className="text-sm text-gray-500">
              {language === 'ar'
                ? 'تابع حالة تنفيذ المهام لجميع المفتشين، مع ربط كل مهمة بتقريرها ومخالفتها.'
                : 'Track the execution status of all inspection tasks, linked to their reports and CDRs.'}
            </p>
          </div>
        </div>
      </div>

      {/* كروت الملخص */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <div className="text-xs text-gray-500 mb-1">
            {language === 'ar' ? 'إجمالي المهام' : 'Total tasks'}
          </div>
          <div className="text-2xl font-bold">{totalTasks}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <div className="text-xs text-gray-500 mb-1">
            {language === 'ar' ? 'قيد الانتظار' : 'Pending'}
          </div>
          <div className="text-2xl font-bold text-gray-700">{pendingCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <div className="text-xs text-gray-500 mb-1">
            {language === 'ar' ? 'جارٍ التنفيذ' : 'In progress'}
          </div>
          <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <div className="text-xs text-gray-500 mb-1">
            {language === 'ar' ? 'منجزة / متأخرة' : 'Completed / Overdue'}
          </div>
          <div className="text-2xl font-bold">
            <span className="text-green-600">{completedCount}</span>
            <span className="text-gray-400 mx-1">/</span>
            <span className="text-red-600">{overdueCount}</span>
          </div>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-5 mb-6">
        <div className="flex items-center gap-2 mb-4 text-gray-600 dark:text-gray-300">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-semibold">
            {language === 'ar' ? 'الفلاتر' : 'Filters'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* حالة المهمة */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {language === 'ar' ? 'الحالة' : 'Status'}
            </label>
            <select
              className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-900"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | TaskStatus)
              }
            >
              <option value="ALL">
                {language === 'ar' ? 'الكل' : 'All'}
              </option>
              <option value={TaskStatus.Pending}>
                {language === 'ar' ? 'قيد الانتظار' : 'Pending'}
              </option>
              <option value={TaskStatus.InProgress}>
                {language === 'ar' ? 'جارٍ التنفيذ' : 'In progress'}
              </option>
              <option value={TaskStatus.Completed}>
                {language === 'ar' ? 'منجزة' : 'Completed'}
              </option>
              <option value={TaskStatus.Overdue}>
                {language === 'ar' ? 'متأخرة' : 'Overdue'}
              </option>
            </select>
          </div>

          {/* المفتش */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {language === 'ar' ? 'المفتش' : 'Inspector'}
            </label>
            <select
              className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-900"
              value={inspectorFilter}
              onChange={(e) =>
                setInspectorFilter(
                  e.target.value === 'ALL' ? 'ALL' : e.target.value,
                )
              }
            >
              <option value="ALL">
                {language === 'ar' ? 'الكل' : 'All'}
              </option>
              {inspectors.map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {ins.name}
                </option>
              ))}
            </select>
          </div>

          {/* مستوى الخطورة */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {language === 'ar' ? 'مستوى الخطورة' : 'Risk level'}
            </label>
            <select
              className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-900"
              value={riskFilter}
              onChange={(e) =>
                setRiskFilter(
                  e.target.value === 'ALL'
                    ? 'ALL'
                    : (Number(e.target.value) as RiskCategory),
                )
              }
            >
              <option value="ALL">
                {language === 'ar' ? 'الكل' : 'All'}
              </option>
              <option value={RiskCategory.High}>
                {t('highRisk')}
              </option>
              <option value={RiskCategory.Medium}>
                {t('mediumRisk')}
              </option>
              <option value={RiskCategory.Low}>
                {t('lowRisk')}
              </option>
            </select>
          </div>

          {/* بحث نصي */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {language === 'ar'
                ? 'بحث (الموقع، المنطقة، المفتش، الملاحظات)'
                : 'Search (location, zone, inspector, notes)'}
            </label>
            <input
              type="text"
              className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'ar' ? 'أدخل نص البحث...' : 'Type to filter...'}
            />
          </div>
        </div>
      </div>

      {/* جدول المهام */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-teal" />
            {language === 'ar'
              ? 'قائمة المهام'
              : 'Task list'}
          </h2>
          <span className="text-xs text-gray-500">
            {language === 'ar'
              ? `${filteredTasks.length} مهمة`
              : `${filteredTasks.length} tasks`}
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            {language === 'ar'
              ? 'لا توجد مهام مطابقة للفلاتر الحالية.'
              : 'No tasks match the current filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                  <th className="text-start py-2 pe-2">
                    {language === 'ar' ? 'الموقع' : 'Location'}
                  </th>
                  <th className="text-start py-2 pe-2">
                    {language === 'ar' ? 'المنطقة' : 'Zone'}
                  </th>
                  <th className="text-start py-2 pe-2">
                    {language === 'ar' ? 'المفتش' : 'Inspector'}
                  </th>
                  <th className="text-start py-2 pe-2">
                    {language === 'ar' ? 'الحالة' : 'Status'}
                  </th>
                  <th className="text-start py-2 pe-2">
                    {language === 'ar' ? 'الخطورة' : 'Risk'}
                  </th>
                  <th className="text-start py-2 pe-2">
                    {language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}
                  </th>
                  <th className="text-start py-2 pe-2">
                    {language === 'ar' ? 'تاريخ الاستحقاق' : 'Due date'}
                  </th>
                  <th className="text-start py-2 pe-2">
                    {language === 'ar' ? 'ملاحظات' : 'Notes'}
                  </th>
                  <th className="text-start py-2 ps-2">
                    {language === 'ar' ? 'روابط' : 'Links'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40"
                  >
                    <td className="py-3 pe-2">
                      <div className="font-semibold text-gray-800 dark:text-gray-100">
                        {getLocationName(task.locationId)}
                      </div>
                    </td>
                    <td className="py-3 pe-2 text-xs text-gray-500">
                      {getZoneName(task.locationId)}
                    </td>
                    <td className="py-3 pe-2">
                      <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-200">
                        <UserCircle2 className="w-4 h-4 text-gray-400" />
                        {getInspectorName(task.inspectorId)}
                      </div>
                    </td>
                    <td className="py-3 pe-2">
                      {renderStatusBadge(task.status)}
                    </td>
                    <td className="py-3 pe-2">
                      {renderRiskBadge(task.riskCategory)}
                    </td>
                    <td className="py-3 pe-2 text-xs text-gray-500">
                      {formatDate(task.createdAt)}
                    </td>
                    <td className="py-3 pe-2 text-xs text-gray-500">
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="py-3 pe-2 text-xs text-gray-600 dark:text-gray-300 max-w-[220px]">
                      {task.notes}
                    </td>
                    <td className="py-3 ps-2">
                      <div className="flex flex-wrap gap-1">
                        {task.relatedReportId && (
                          <button
                            onClick={() =>
                              navigate(`/report/${task.relatedReportId}`)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-brand-teal text-white hover:bg-brand-blue"
                          >
                            <Eye className="w-3 h-3" />
                            {language === 'ar' ? 'تقرير' : 'Report'}
                          </button>
                        )}
                        {task.relatedCdrId && (
                          <button
                            onClick={() =>
                              navigate(`/cdr/${task.relatedCdrId}`)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            <FileWarning className="w-3 h-3" />
                            {language === 'ar' ? 'مخالفة' : 'CDR'}
                          </button>
                        )}
                        {!task.relatedReportId && !task.relatedCdrId && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-500">
                            <XCircle className="w-3 h-3" />
                            {language === 'ar' ? 'لا روابط' : 'No links'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskMonitoringPage;
