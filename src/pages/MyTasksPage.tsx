import React, { useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { useI18n } from '../hooks/useI18n';
import { InspectionTask, TaskStatus, RiskCategory } from '../types';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

const MyTasksPage: React.FC = () => {
  const { user, tasks, getTasksForInspector, locations, zones } = useContext(AppContext);
  const { t, language } = useI18n();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-500">
        {t('notAuthorized')}
      </div>
    );
  }

  // مهامي فقط (لو getTasksForInspector موجود نستخدمه، غير كذا نفلتر tasks مباشرة)
  const myTasks: InspectionTask[] = useMemo(
    () =>
      getTasksForInspector
        ? getTasksForInspector(user.id)
        : tasks.filter((t) => t.inspectorId === user.id),
    [tasks, user.id, getTasksForInspector]
  );

  const pendingTasks = myTasks.filter(
    (t) =>
      t.status === TaskStatus.Pending ||
      t.status === TaskStatus.InProgress ||
      t.status === TaskStatus.Overdue
  );
  const completedTasks = myTasks.filter((t) => t.status === TaskStatus.Completed);

  const getLocationName = (locationId: string) => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return locationId;
    return loc.name[language] ?? Object.values(loc.name)[0];
  };

  const getRiskBadge = (task: InspectionTask) => {
    // نحاول نجيب الـ Zone من خلال location
    const loc = locations.find((l) => l.id === task.locationId);
    const zone = zones.find((z) => z.id === loc?.zoneId);
    const risk = zone?.riskCategory ?? task.riskCategory;

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
        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
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

  const handleStartInspection = (taskId: string, locationId: string) => {
    // نفتح شاشة التفتيش الجديدة مع تمرير taskId و locationId في الـ URL
    navigate(`/new-inspection?taskId=${taskId}&locationId=${locationId}`);
  };

  const handleOpenReport = (reportId: string) => {
    navigate(`/report/${reportId}`);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="w-7 h-7 text-brand-teal" />
        <div>
          <h1 className="text-2xl font-bold">{t('myTasks')}</h1>
          <p className="text-gray-500 text-sm">
            {language === 'ar'
              ? `هذه قائمة مهام التفتيش المكلف بها المفتش ${user.name}.`
              : `This is the list of inspection tasks currently assigned to inspector ${user.name}.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* عمود المهام الحالية */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
              <Clock className="w-5 h-5" />
              {t('pendingTasks')}
            </h2>
            <span className="text-sm text-gray-500">
              {pendingTasks.length}{' '}
              {language === 'ar' ? 'مهمة' : 'tasks'}
            </span>
          </div>

          {pendingTasks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              {t('noPendingTasks')}
            </p>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 flex flex-col gap-2 bg-gray-50 dark:bg-gray-900/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {getLocationName(task.locationId)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {language === 'ar' ? 'تاريخ الاستحقاق:' : 'Due date:'}{' '}
                        {formatDate(task.dueDate)}
                      </div>
                    </div>
                    {getRiskBadge(task)}
                  </div>

                  {task.notes && (
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {task.notes}
                    </div>
                  )}

                  <div className="flex items-center justify-end mt-2">
                    <button
                      onClick={() =>
                        handleStartInspection(task.id, task.locationId)
                      }
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-brand-teal text-white hover:bg-brand-blue transition"
                    >
                      {t('startInspection')}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* عمود المهام المنجزة */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              {t('completedTasks')}
            </h2>
            <span className="text-sm text-gray-500">
              {completedTasks.length}{' '}
              {language === 'ar' ? 'مهمة' : 'tasks'}
            </span>
          </div>

          {completedTasks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              {t('noCompletedTasks')}
            </p>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 flex flex-col gap-2 bg-green-50 dark:bg-green-900/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {getLocationName(task.locationId)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t('finishedAt')}: {formatDate(task.dueDate)}
                      </div>
                    </div>
                    {getRiskBadge(task)}
                  </div>

                  {task.notes && (
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {task.notes}
                    </div>
                  )}

                  {task.relatedReportId && (
                    <div className="flex items-center justify-end mt-2">
                      <button
                        onClick={() =>
                          handleOpenReport(task.relatedReportId as string)
                        }
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white transition"
                      >
                        {t('viewReport')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTasksPage;
