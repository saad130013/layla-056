import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { useI18n } from '../hooks/useI18n';
import { InspectionTask, RiskCategory, TaskStatus, UserRole } from '../types';
import { AlertTriangle, ClipboardList, Clock, MapPin, Shield, UserCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LocationSchedulingView {
  locationId: string;
  locationName: string;
  zoneName: string;
  riskCategory: RiskCategory;
  lastInspectionDate?: string;
  riskScore: number;
}

const TaskSchedulingPage: React.FC = () => {
  const { user, users, reports, locations, zones, createTask } = useContext(AppContext);
  const { t, language } = useI18n();
  const navigate = useNavigate();

  // السماح فقط للمشرف أو المدير الأعلى
  if (!user || (user.role !== UserRole.Supervisor && user.role !== UserRole.Executive)) {
    return (
      <div className="p-6 text-center text-gray-500">
        {t('notAuthorized') ?? 'ليست لديك صلاحية لعرض هذه الصفحة.'}
      </div>
    );
  }

  // قائمة المفتشين فقط
  const inspectors = users.filter(u => u.role === UserRole.Inspector);

  // 🧠 حساب درجة الخطورة / الأولوية لكل موقع
  const locationsWithScore: LocationSchedulingView[] = useMemo(() => {
    return locations.map(loc => {
      const zone = zones.find(z => z.id === loc.zoneId);
      const riskCategory = zone?.riskCategory ?? RiskCategory.Low;

      // آخر تقرير تفتيش لهذا الموقع
      const locReports = reports.filter(r => r.locationId === loc.id);
      const lastReport = locReports.sort((a, b) => b.date.localeCompare(a.date))[0];

      let base = 0;
      if (riskCategory === RiskCategory.High) base = 100;
      else if (riskCategory === RiskCategory.Medium) base = 70;
      else base = 40;

      let recencyBonus = 0;
      if (lastReport) {
        const last = new Date(lastReport.date);
        const today = new Date();
        const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        // كل ما طالت المدة من آخر تفتيش، تزيد الأولوية
        recencyBonus = Math.min(diffDays, 60); // سقف ٦٠ نقطة
      } else {
        // مواقع لم تُفتَّش من قبل → نرفعها زيادة
        recencyBonus = 50;
      }

      const riskScore = base + recencyBonus;

      return {
        locationId: loc.id,
        locationName: loc.name[language] ?? Object.values(loc.name)[0],
        zoneName: zone ? (zone.name?.[language] ?? Object.values(zone.name ?? {})[0] ?? zone.id) : '',
        riskCategory,
        lastInspectionDate: lastReport?.date,
        riskScore,
      };
    }).sort((a, b) => b.riskScore - a.riskScore); // الأعلى خطورة أولاً
  }, [locations, zones, reports, language]);

  // حالة اختيار المفتش + تاريخ الاستحقاق + ملاحظات لكل موقع
  const [assignedInspector, setAssignedInspector] = useState<Record<string, string>>({});
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const handleCreateTask = async (loc: LocationSchedulingView) => {
    const inspectorId = assignedInspector[loc.locationId];
    const dueDate = dueDates[loc.locationId];

    if (!inspectorId || !dueDate) {
      alert(language === 'ar'
        ? 'الرجاء اختيار المفتش وتاريخ الاستحقاق قبل إنشاء المهمة.'
        : 'Please select an inspector and due date before creating the task.');
      return;
    }

    setCreatingFor(loc.locationId);

    const taskInput: Omit<InspectionTask, 'id' | 'createdAt'> = {
      inspectorId,
      locationId: loc.locationId,
      riskCategory: loc.riskCategory,
      status: TaskStatus.Pending,
      dueDate: new Date(dueDate).toISOString(),
      createdBy: user.id,
      notes: notes[loc.locationId] || '',
      relatedReportId: undefined,
      relatedCdrId: undefined,
    };

    try {
      const newTask = await createTask(taskInput);
      console.log('Created task:', newTask);
      // ممكن نوجّه المشرف إلى صفحة مراقبة المهام أو نكتفي برسالة بسيطة
      // navigate('/task-monitoring');
    } finally {
      setCreatingFor(null);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return language === 'ar' ? 'لم يُفحص من قبل' : 'Not inspected yet';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderRiskChip = (risk: RiskCategory) => {
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

  return (
    <div className="p-4 sm:p-6">
      {/* العنوان العلوي */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-brand-teal" />
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'ar' ? 'جدولة مهام التفتيش الذكية' : 'Smart Inspection Scheduling'}
            </h1>
            <p className="text-sm text-gray-500">
              {language === 'ar'
                ? 'قم بتوليد ومتابعة مهام التفتيش بناءً على مستوى الخطورة وآخر زيارة لكل موقع.'
                : 'Generate and manage inspection tasks based on risk levels and last visit dates.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/task-monitoring')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-semibold hover:bg-brand-blue transition"
        >
          <ClipboardList className="w-4 h-4" />
          {language === 'ar' ? 'مراقبة المهام' : 'Task Monitoring'}
        </button>
      </div>

      {/* جدول المواقع مرتبة حسب الخطورة */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-teal" />
            {language === 'ar' ? 'المواقع المقترحة للتفتيش' : 'Suggested locations for inspection'}
          </h2>
          <span className="text-xs text-gray-500">
            {language === 'ar'
              ? `${locationsWithScore.length} موقع`
              : `${locationsWithScore.length} locations`}
          </span>
        </div>

        {locationsWithScore.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            {language === 'ar'
              ? 'لا توجد مواقع متاحة حالياً.'
              : 'No locations available at the moment.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                  <th className="text-start py-2 pe-2">{language === 'ar' ? 'الموقع' : 'Location'}</th>
                  <th className="text-start py-2 pe-2">{language === 'ar' ? 'المنطقة' : 'Zone'}</th>
                  <th className="text-start py-2 pe-2">{language === 'ar' ? 'الخطورة' : 'Risk'}</th>
                  <th className="text-start py-2 pe-2">{language === 'ar' ? 'آخر تفتيش' : 'Last inspection'}</th>
                  <th className="text-start py-2 pe-2">{language === 'ar' ? 'الأولوية' : 'Priority score'}</th>
                  <th className="text-start py-2 pe-2">{language === 'ar' ? 'المفتش' : 'Inspector'}</th>
                  <th className="text-start py-2 pe-2">{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due date'}</th>
                  <th className="text-start py-2 pe-2">{language === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                  <th className="text-start py-2 ps-2"></th>
                </tr>
              </thead>
              <tbody>
                {locationsWithScore.map((loc) => (
                  <tr
                    key={loc.locationId}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40"
                  >
                    <td className="py-3 pe-2">
                      <div className="font-semibold text-gray-800 dark:text-gray-100">{loc.locationName}</div>
                    </td>
                    <td className="py-3 pe-2 text-gray-600 dark:text-gray-300 text-xs">
                      {loc.zoneName}
                    </td>
                    <td className="py-3 pe-2">
                      {renderRiskChip(loc.riskCategory)}
                    </td>
                    <td className="py-3 pe-2 text-xs text-gray-500">
                      {formatDate(loc.lastInspectionDate)}
                    </td>
                    <td className="py-3 pe-2 text-xs">
                      <span className="inline-flex px-2 py-1 rounded-full bg-brand-gray text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {loc.riskScore}
                      </span>
                    </td>
                    <td className="py-3 pe-2">
                      <div className="flex items-center gap-1">
                        <UserCircle2 className="w-4 h-4 text-gray-400" />
                        <select
                          className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-1 py-1 bg-white dark:bg-gray-900"
                          value={assignedInspector[loc.locationId] || ''}
                          onChange={(e) =>
                            setAssignedInspector((prev) => ({
                              ...prev,
                              [loc.locationId]: e.target.value,
                            }))
                          }
                        >
                          <option value="">
                            {language === 'ar' ? 'اختر' : 'Select'}
                          </option>
                          {inspectors.map((ins) => (
                            <option key={ins.id} value={ins.id}>
                              {ins.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-3 pe-2">
                      <input
                        type="date"
                        className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-1 py-1 bg-white dark:bg-gray-900"
                        value={dueDates[loc.locationId] || ''}
                        onChange={(e) =>
                          setDueDates((prev) => ({
                            ...prev,
                            [loc.locationId]: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="py-3 pe-2">
                      <input
                        type="text"
                        className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900 max-w-[160px]"
                        placeholder={language === 'ar' ? 'تعليمات للمفتش' : 'Instructions'}
                        value={notes[loc.locationId] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [loc.locationId]: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="py-3 ps-2">
                      <button
                        onClick={() => handleCreateTask(loc)}
                        disabled={creatingFor === loc.locationId}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-teal text-white hover:bg-brand-blue disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                      >
                        {creatingFor === loc.locationId
                          ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...')
                          : (language === 'ar' ? 'إنشاء مهمة' : 'Create task')}
                        {creatingFor !== loc.locationId && (
                          <ArrowRight className="w-3 h-3" />
                        )}
                      </button>
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

export default TaskSchedulingPage;
